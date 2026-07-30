import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FieldDefinition } from "@passidex/schema";

export interface ParseDocument {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface ExtractedFieldResult {
  fieldKey: string;
  value: unknown;
  confidence: number;
  note?: string;
}

const TOOL_NAME = "record_extracted_fields";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * Thin Anthropic Messages API client that turns a supplier's reply (email text
 * + attached PDF / image / spreadsheet) into structured field values via forced
 * tool use. When ANTHROPIC_API_KEY is absent it returns [] so the rest of the
 * inbound pipeline still runs in dev.
 */
@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>("ANTHROPIC_API_KEY");
  }

  async extract(
    fields: FieldDefinition[],
    emailText: string,
    documents: ParseDocument[],
  ): Promise<{ model: string; results: ExtractedFieldResult[] }> {
    const model = this.config.get<string>("ANTHROPIC_MODEL") || "claude-sonnet-5";
    if (!this.enabled) {
      this.logger.warn("ANTHROPIC_API_KEY not set — skipping AI extraction.");
      return { model, results: [] };
    }

    const content = this.buildContent(fields, emailText, documents);
    const tool = this.buildTool(fields);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.get<string>("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        tools: [tool],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      content?: { type: string; name?: string; input?: unknown }[];
    };
    const toolUse = json.content?.find(
      (b) => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    const input = (toolUse?.input ?? {}) as { extractions?: ExtractedFieldResult[] };
    const results = Array.isArray(input.extractions) ? input.extractions : [];
    this.logger.log(`AI extracted ${results.length} field(s) with ${model}.`);
    return { model, results };
  }

  private buildContent(
    fields: FieldDefinition[],
    emailText: string,
    documents: ParseDocument[],
  ): unknown[] {
    const catalogue = fields
      .map((f) => {
        const parts = [`- ${f.key} (${f.label}) — tip: ${f.type}`];
        if (f.unit) parts.push(`enota: ${f.unit}`);
        if (f.options) parts.push(`možnosti: ${f.options.join(" | ")}`);
        if (f.help) parts.push(`opomba: ${f.help}`);
        return parts.join(", ");
      })
      .join("\n");

    const instructions =
      `Iz dobaviteljevega odgovora izlušči vrednosti SAMO za spodaj našteta polja ` +
      `digitalnega potnega lista izdelka (DPP). Ne ugibaj: če podatka ni ali je nejasen, ` +
      `polja NE vključi ali mu nastavi nizko gotovost. Vrednost oblikuj po tipu polja:\n` +
      `- percentage: število 0–100\n` +
      `- quantity: {"amount": število, "unit": "enota"}\n` +
      `- enum: točno ena od naštetih možnosti\n` +
      `- material_composition: [{"name": "ime", "pct": število}]\n` +
      `- string / cert_ref: niz\n\n` +
      `Za vsako polje navedi gotovost (confidence) med 0 in 1.\n\n` +
      `POLJA:\n${catalogue}\n\n` +
      `--- Besedilo e-pošte dobavitelja ---\n${emailText || "(brez besedila)"}`;

    const content: unknown[] = [{ type: "text", text: instructions }];

    for (const doc of documents) {
      const b64 = doc.data.toString("base64");
      if (doc.contentType === "application/pdf") {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 },
        });
      } else if (IMAGE_TYPES.includes(doc.contentType)) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: doc.contentType, data: b64 },
        });
      } else if (
        doc.contentType.startsWith("text/") ||
        doc.contentType === "application/csv"
      ) {
        content.push({
          type: "text",
          text: `--- Priponka ${doc.filename} ---\n${doc.data.toString("utf-8").slice(0, 20000)}`,
        });
      } else {
        content.push({
          type: "text",
          text: `--- Priponka ${doc.filename} (${doc.contentType}) ni neposredno berljiva; obravnavaj le, če je omenjena v besedilu. ---`,
        });
      }
    }
    return content;
  }

  private buildTool(fields: FieldDefinition[]) {
    return {
      name: TOOL_NAME,
      description:
        "Zabeleži vrednosti polj DPP, izluščene iz dobaviteljevega odgovora.",
      input_schema: {
        type: "object",
        properties: {
          extractions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldKey: {
                  type: "string",
                  enum: fields.map((f) => f.key),
                },
                value: {
                  description:
                    "Vrednost, oblikovana po tipu polja (število, niz, {amount,unit} ali [{name,pct}]).",
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                note: { type: "string" },
              },
              required: ["fieldKey", "value", "confidence"],
            },
          },
        },
        required: ["extractions"],
      },
    };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { ActorType, FieldSource, FieldStatus, Prisma } from "@prisma/client";
import { getFieldDefinition, type FieldDefinition } from "@passidex/schema";
import { PrismaService } from "../prisma/prisma.service";
import { FieldValueService } from "../field-values/field-value.service";
import { CONFIDENCE_THRESHOLD } from "../field-values/field-status.util";
import { StorageService } from "../storage/storage.service";
import { AnthropicService } from "./anthropic.service";

/**
 * Turns a received supplier message into proposed field values.
 *
 * AI never confirms: every mapped value lands in RECEIVED_PENDING, flagged
 * needsReview when confidence is below threshold. Confirmed fields are never
 * overwritten. Values that fail structural validation are recorded on the
 * Extraction for audit but not proposed.
 */
@Injectable()
export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly storage: StorageService,
    private readonly fields: FieldValueService,
  ) {}

  async process(messageId: string): Promise<{ proposed: number; extracted: number }> {
    const message = await this.prisma.inboundMessage.findUnique({
      where: { id: messageId },
      include: {
        request: { include: { fields: true, product: true } },
        documents: true,
      },
    });
    if (!message?.request) {
      this.logger.warn(`Inbound ${messageId} has no linked request — skipping.`);
      return { proposed: 0, extracted: 0 };
    }

    const product = message.request.product;
    const requestedKeys = new Set(message.request.fields.map((f) => f.fieldKey));
    const defs = message.request.fields
      .map((f) => getFieldDefinition(product.categoryKey, f.fieldKey))
      .filter((d): d is FieldDefinition => !!d);

    const docs = await Promise.all(
      message.documents.map(async (d) => ({
        filename: d.filename,
        contentType: d.contentType,
        data: await this.storage.get(d.storageKey),
      })),
    );

    const { model, results } = await this.anthropic.extract(
      defs,
      message.rawBody ?? "",
      docs,
    );

    // Record the raw extraction for audit regardless of what we propose.
    await this.prisma.extraction.create({
      data: {
        messageId: message.id,
        model,
        rawJson: results as unknown as Prisma.InputJsonValue,
        fields: {
          create: results.map((r) => ({
            fieldKey: r.fieldKey,
            proposedValue: (r.value ?? Prisma.DbNull) as Prisma.InputJsonValue,
            confidence: r.confidence,
            needsReview: r.confidence < CONFIDENCE_THRESHOLD,
          })),
        },
      },
    });

    let proposed = 0;
    for (const r of results) {
      if (!requestedKeys.has(r.fieldKey)) continue;
      const fv = await this.prisma.fieldValue.findFirst({
        where: { productId: product.id, fieldKey: r.fieldKey },
      });
      if (!fv || fv.status === FieldStatus.CONFIRMED) continue;
      try {
        await this.fields.propose(fv.id, {
          value: r.value,
          source: FieldSource.AI_EXTRACTED,
          confidence: r.confidence,
          ambiguous: r.confidence < CONFIDENCE_THRESHOLD,
          actor: { type: ActorType.AI },
          sourceRef: message.id,
        });
        proposed += 1;
      } catch (e) {
        this.logger.warn(
          `Field "${r.fieldKey}" not proposed (validation): ${(e as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Inbound ${messageId}: ${results.length} extracted, ${proposed} proposed for review.`,
    );
    return { proposed, extracted: results.length };
  }
}

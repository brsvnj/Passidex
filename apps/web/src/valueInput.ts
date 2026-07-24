import type { FieldDefinition } from "@passidex/schema";

/**
 * Parse a raw text input into the structured value shape expected for a field.
 * Throws with a message on invalid input. Used by manual entry / corrections.
 */
export function parseInput(def: FieldDefinition, raw: string): unknown {
  const text = raw.trim();
  if (text === "") throw new Error("Vrednost ne sme biti prazna");
  switch (def.type) {
    case "percentage": {
      const n = Number(text.replace("%", "").trim());
      if (Number.isNaN(n) || n < 0 || n > 100) throw new Error("Vnesi število 0–100");
      return n;
    }
    case "quantity": {
      // "38 kg CO₂e/kos" → { amount: 38, unit: "kg CO₂e/kos" }
      const m = text.match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!m) throw new Error("Vnesi npr. '38 kg CO₂e/kos'");
      return {
        amount: Number(m[1].replace(",", ".")),
        unit: m[2].trim() || def.unit || "",
      };
    }
    case "enum": {
      if (def.options && !def.options.includes(text)) {
        throw new Error(`Izberi enega od: ${def.options.join(", ")}`);
      }
      return text;
    }
    case "material_composition": {
      // "Bombaž:62, Poliester:28, Elastan:10"
      const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
      const materials = parts.map((p) => {
        const [name, pct] = p.split(":").map((s) => s.trim());
        const n = Number(pct);
        if (!name || Number.isNaN(n)) throw new Error("Format: 'Ime:delež, Ime:delež'");
        return { name, pct: n };
      });
      return materials;
    }
    default:
      return text;
  }
}

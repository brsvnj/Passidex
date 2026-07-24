import { FieldStatus } from "@prisma/client";
import { getFieldDefinition, type FieldDefinition } from "@passidex/schema";

/**
 * AI proposals at or above this confidence are surfaced as normal
 * "čaka potrditev" items; below it they are additionally flagged
 * `needsReview`. Either way the user always confirms — AI never auto-confirms.
 */
export const CONFIDENCE_THRESHOLD = 0.75;

/** Statuses that count as "the data is in and trusted". */
export const CONFIRMED_STATUSES: FieldStatus[] = [FieldStatus.CONFIRMED];

/** Whether a value should be flagged for manual review. */
export function computeNeedsReview(opts: {
  confidence?: number | null;
  ambiguous?: boolean;
}): boolean {
  if (opts.ambiguous) return true;
  if (opts.confidence === undefined || opts.confidence === null) return false;
  return opts.confidence < CONFIDENCE_THRESHOLD;
}

/**
 * Lightweight structural validation of a value against its field definition.
 * Returns a (possibly normalised) value, or throws with a human message.
 * Full domain validation (unit coercion, enum canonicalisation) grows here.
 */
export function validateFieldValue(
  categoryKey: string,
  fieldKey: string,
  value: unknown,
): unknown {
  const def = getFieldDefinition(categoryKey, fieldKey);
  if (!def) {
    throw new Error(`Unknown field "${fieldKey}" for category "${categoryKey}"`);
  }
  return coerceByType(def, value);
}

function coerceByType(def: FieldDefinition, value: unknown): unknown {
  switch (def.type) {
    case "percentage": {
      const n = typeof value === "string" ? Number(value) : value;
      if (typeof n !== "number" || Number.isNaN(n) || n < 0 || n > 100) {
        throw new Error(`Field "${def.key}" must be a percentage between 0 and 100`);
      }
      return n;
    }
    case "quantity": {
      if (
        typeof value !== "object" ||
        value === null ||
        typeof (value as { amount?: unknown }).amount !== "number"
      ) {
        throw new Error(`Field "${def.key}" must be { amount: number, unit: string }`);
      }
      const q = value as { amount: number; unit?: string };
      return { amount: q.amount, unit: q.unit ?? def.unit ?? "" };
    }
    case "enum": {
      if (typeof value !== "string" || (def.options && !def.options.includes(value))) {
        throw new Error(
          `Field "${def.key}" must be one of: ${(def.options ?? []).join(", ")}`,
        );
      }
      return value;
    }
    case "material_composition": {
      if (!Array.isArray(value)) {
        throw new Error(`Field "${def.key}" must be an array of { name, pct }`);
      }
      for (const m of value) {
        if (
          typeof m !== "object" ||
          m === null ||
          typeof (m as { name?: unknown }).name !== "string" ||
          typeof (m as { pct?: unknown }).pct !== "number"
        ) {
          throw new Error(`Field "${def.key}" entries must be { name: string, pct: number }`);
        }
      }
      return value;
    }
    case "cert_ref":
    case "string": {
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Field "${def.key}" must be a non-empty string`);
      }
      return value.trim();
    }
    default:
      return value;
  }
}

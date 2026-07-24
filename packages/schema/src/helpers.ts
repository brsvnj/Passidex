import { CATEGORIES } from "./categories.js";
import type { CategoryDefinition, FieldDefinition } from "./types.js";

/** Look up a category by key. Returns undefined if unknown. */
export function getCategory(key: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

/** Look up a category by key, falling back to the first category (MVP behaviour). */
export function categoryOrDefault(key: string): CategoryDefinition {
  return getCategory(key) ?? CATEGORIES[0];
}

/** All field definitions for a category. */
export function fieldsOf(categoryKey: string): FieldDefinition[] {
  return getCategory(categoryKey)?.fields ?? [];
}

/** A single field definition within a category. */
export function getFieldDefinition(
  categoryKey: string,
  fieldKey: string,
): FieldDefinition | undefined {
  return fieldsOf(categoryKey).find((f) => f.key === fieldKey);
}

/** Fields required for compliance in a category. */
export function requiredFields(categoryKey: string): FieldDefinition[] {
  return fieldsOf(categoryKey).filter((f) => f.required);
}

/** True if the category exists in the schema. */
export function isKnownCategory(key: string): boolean {
  return getCategory(key) !== undefined;
}

/** Prefix used when minting internal passport codes (SI- for EU/ESPR, CPR- for construction). */
export function passportPrefix(categoryKey: string): string {
  return getCategory(categoryKey)?.framework === "CPR" ? "CPR" : "SI";
}

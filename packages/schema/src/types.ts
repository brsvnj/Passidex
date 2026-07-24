/**
 * Shared type definitions for Passidex product-category schemas.
 *
 * These types describe *what data a passport needs* per category. They are the
 * single source of truth shared by the frontend (rendering, forms) and the
 * backend (computing missing fields, validating supplier answers, exporting to
 * the EU DPP Registry / GS1 Digital Link).
 *
 * This package intentionally has NO framework dependencies (no React, no Nest).
 */

/** Regulatory framework a category falls under. */
export type FrameworkId =
  | "ESPR" // Ecodesign for Sustainable Products Regulation
  | "CPR" // Construction Products Regulation
  | "BATTERY_REG"; // Batteries Regulation (EU) 2023/1542

/** Who typically supplies a given field's data. */
export type SuppliedBy = "supplier" | "manufacturer";

/**
 * The value shape a field carries. Drives both the input UI and the AI
 * extraction target (the parser is told which shape to return per field).
 */
export type FieldType =
  | "material_composition" // value: MaterialShare[]  (name + percentage, summing to ~100)
  | "percentage" // value: number (0..100)
  | "quantity" // value: { amount: number; unit: string }
  | "enum" // value: string (one of options)
  | "string" // value: string
  | "cert_ref"; // value: string (a certificate / declaration reference number)

export interface MaterialShare {
  name: string;
  /** Percentage share, 0..100. */
  pct: number;
}

export type FieldValueShape =
  | MaterialShare[]
  | number
  | { amount: number; unit: string }
  | string;

export interface FieldDefinition {
  /** Stable machine key, unique within a category. e.g. "recycled_content_pct". */
  key: string;
  /** Human label (Slovenian primary UI language). */
  label: string;
  type: FieldType;
  framework: FrameworkId;
  /** Required for compliance? Drives completeness scoring. */
  required: boolean;
  /** Who typically holds this data — used to decide whom to ask. */
  suppliedBy: SuppliedBy;
  /** Unit hint for `quantity` / display, e.g. "kg CO₂e/kWh". */
  unit?: string;
  /** Allowed values for `enum` fields. */
  options?: string[];
  /** Short helper text shown to users and included in supplier requests. */
  help?: string;
  /**
   * Mapping into the target DPP data model (dot path). Used by the Phase 5
   * exporter to project confirmed values into GS1 Digital Link / EU DPP
   * Registry format without touching stored data.
   */
  dppPath: string;
}

/** Visual grouping hint for the passport card (mirrors the MVP). */
export type CategoryKind = "materials" | "specs" | "construction";

export interface CategoryDefinition {
  /** Stable key, referenced by Product.categoryKey. */
  key: string;
  label: string;
  framework: FrameworkId;
  /** Human-readable regulatory framework label (may include regulation number). */
  frameworkLabel: string;
  /** Compliance deadline hint shown in the UI. */
  eta: string;
  kind: CategoryKind;
  /** Icon name resolved to a component in the frontend (no React here). */
  icon: string;
  /** The data this category's passport requires. */
  fields: FieldDefinition[];
}

/** A single revision of the whole category schema set. Bump when fields change. */
export const SCHEMA_VERSION = "2026.07";

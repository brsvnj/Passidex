import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_THRESHOLD,
  computeNeedsReview,
  validateFieldValue,
} from "./field-status.util";

describe("computeNeedsReview", () => {
  it("flags ambiguous values regardless of confidence", () => {
    expect(computeNeedsReview({ ambiguous: true, confidence: 0.99 })).toBe(true);
  });

  it("does not flag when there is no confidence signal", () => {
    expect(computeNeedsReview({})).toBe(false);
    expect(computeNeedsReview({ confidence: null })).toBe(false);
  });

  it("flags confidence below the threshold only", () => {
    expect(computeNeedsReview({ confidence: CONFIDENCE_THRESHOLD - 0.01 })).toBe(true);
    expect(computeNeedsReview({ confidence: CONFIDENCE_THRESHOLD })).toBe(false);
    expect(computeNeedsReview({ confidence: 0.95 })).toBe(false);
  });
});

describe("validateFieldValue", () => {
  it("accepts and coerces percentages", () => {
    expect(validateFieldValue("textile", "recycled_content_pct", "28")).toBe(28);
    expect(() =>
      validateFieldValue("textile", "recycled_content_pct", 150),
    ).toThrow();
  });

  it("normalises quantities with a default unit", () => {
    expect(
      validateFieldValue("batteries", "capacity", { amount: 75 }),
    ).toEqual({ amount: 75, unit: "kWh" });
    expect(() =>
      validateFieldValue("batteries", "capacity", "nope"),
    ).toThrow();
  });

  it("enforces enum options", () => {
    expect(validateFieldValue("tires", "rolling_resistance", "B")).toBe("B");
    expect(() =>
      validateFieldValue("tires", "rolling_resistance", "Z"),
    ).toThrow();
  });

  it("validates material composition arrays", () => {
    const value = [{ name: "Bombaž", pct: 60 }];
    expect(validateFieldValue("textile", "material_composition", value)).toBe(value);
    expect(() =>
      validateFieldValue("textile", "material_composition", "not-array"),
    ).toThrow();
  });

  it("trims strings and rejects empties", () => {
    expect(validateFieldValue("textile", "country_of_origin", "  SI ")).toBe("SI");
    expect(() =>
      validateFieldValue("textile", "country_of_origin", "   "),
    ).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => validateFieldValue("textile", "ghost", "x")).toThrow();
  });
});

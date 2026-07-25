import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  categoryOrDefault,
  getCategory,
  isKnownCategory,
  passportPrefix,
  requiredFields,
} from "../index.js";

describe("schema helpers", () => {
  it("looks up a known category and falls back for unknown", () => {
    expect(getCategory("textile")?.label).toBe("Tekstil in oblačila");
    expect(getCategory("nope")).toBeUndefined();
    expect(categoryOrDefault("nope")).toBe(CATEGORIES[0]);
  });

  it("reports known categories", () => {
    expect(isKnownCategory("batteries")).toBe(true);
    expect(isKnownCategory("ghost")).toBe(false);
  });

  it("picks the passport prefix by framework", () => {
    expect(passportPrefix("textile")).toBe("SI");
    expect(passportPrefix("construction_doors")).toBe("CPR");
    expect(passportPrefix("unknown")).toBe("SI");
  });

  it("returns only required fields", () => {
    const req = requiredFields("construction_doors").map((f) => f.key);
    expect(req).toContain("dop_number");
    expect(req).not.toContain(
      // an optional field should be excluded
      requiredFields("construction_doors").length === CATEGORIES.length
        ? ""
        : "nonexistent",
    );
  });
});

describe("schema integrity", () => {
  it("every field has a dppPath and unique key within its category", () => {
    for (const cat of CATEGORIES) {
      expect(cat.fields.length).toBeGreaterThan(0);
      const keys = new Set<string>();
      for (const f of cat.fields) {
        expect(f.dppPath, `${cat.key}.${f.key} dppPath`).toBeTruthy();
        expect(keys.has(f.key), `${cat.key}.${f.key} duplicate`).toBe(false);
        keys.add(f.key);
      }
    }
  });

  it("CPR categories are marked CPR and map to the CPR prefix", () => {
    for (const cat of CATEGORIES.filter((c) => c.key.startsWith("construction"))) {
      expect(cat.framework).toBe("CPR");
      expect(passportPrefix(cat.key)).toBe("CPR");
    }
  });

  it("enum fields declare options", () => {
    for (const cat of CATEGORIES) {
      for (const f of cat.fields) {
        if (f.type === "enum") {
          expect(f.options?.length, `${cat.key}.${f.key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

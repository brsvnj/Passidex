import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@passidex/schema";
import { parseInput } from "./valueInput";

const def = (over: Partial<FieldDefinition>): FieldDefinition => ({
  key: "f",
  label: "F",
  type: "string",
  framework: "ESPR",
  required: false,
  suppliedBy: "supplier",
  dppPath: "x.y",
  ...over,
});

describe("parseInput", () => {
  it("parses percentages and rejects out-of-range", () => {
    expect(parseInput(def({ type: "percentage" }), "28 %")).toBe(28);
    expect(() => parseInput(def({ type: "percentage" }), "150")).toThrow();
  });

  it("parses quantities into amount + unit", () => {
    expect(parseInput(def({ type: "quantity", unit: "kg" }), "38 kg CO₂e")).toEqual({
      amount: 38,
      unit: "kg CO₂e",
    });
    expect(parseInput(def({ type: "quantity", unit: "kWh" }), "75")).toEqual({
      amount: 75,
      unit: "kWh",
    });
  });

  it("validates enum options", () => {
    const d = def({ type: "enum", options: ["A", "B"] });
    expect(parseInput(d, "A")).toBe("A");
    expect(() => parseInput(d, "Z")).toThrow();
  });

  it("parses material composition", () => {
    expect(
      parseInput(def({ type: "material_composition" }), "Bombaž:62, Elastan:10"),
    ).toEqual([
      { name: "Bombaž", pct: 62 },
      { name: "Elastan", pct: 10 },
    ]);
  });

  it("rejects empty input", () => {
    expect(() => parseInput(def({ type: "string" }), "  ")).toThrow();
  });
});

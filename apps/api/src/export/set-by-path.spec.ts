import { describe, expect, it } from "vitest";
import { setByPath } from "./set-by-path";

describe("setByPath", () => {
  it("creates nested objects along a dotted path", () => {
    const root: Record<string, unknown> = {};
    setByPath(root, "carbon.gwpA1A3", 38);
    expect(root).toEqual({ carbon: { gwpA1A3: 38 } });
  });

  it("merges into existing branches without clobbering siblings", () => {
    const root: Record<string, unknown> = { carbon: { gwpA1A3: 38 } };
    setByPath(root, "carbon.footprintPerKwh", 82);
    expect(root).toEqual({ carbon: { gwpA1A3: 38, footprintPerKwh: 82 } });
  });

  it("handles single-segment paths and overwrites", () => {
    const root: Record<string, unknown> = { a: 1 };
    setByPath(root, "a", 2);
    expect(root.a).toBe(2);
  });

  it("stores structured values", () => {
    const root: Record<string, unknown> = {};
    setByPath(root, "materials.composition", [{ name: "X", pct: 100 }]);
    expect(root).toEqual({ materials: { composition: [{ name: "X", pct: 100 }] } });
  });
});

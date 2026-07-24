import type { FieldDefinition } from "@passidex/schema";

/** Human-readable rendering of a stored field value by its definition type. */
export function formatValue(def: FieldDefinition | undefined, value: unknown): string {
  if (value === null || value === undefined) return "—";
  switch (def?.type) {
    case "percentage":
      return `${value as number} %`;
    case "quantity": {
      const q = value as { amount: number; unit?: string };
      return `${q.amount} ${q.unit ?? def?.unit ?? ""}`.trim();
    }
    case "material_composition":
      return (value as { name: string; pct: number }[])
        .map((m) => `${m.name} ${m.pct}%`)
        .join(", ");
    default:
      return String(value);
  }
}

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  MISSING: { label: "manjka", color: "#8A8570", bg: "rgba(138,133,112,0.14)" },
  REQUESTED: { label: "poslana zahteva", color: "#A85D3B", bg: "rgba(168,93,59,0.14)" },
  RECEIVED_PENDING: {
    label: "čaka potrditev",
    color: "#B7791F",
    bg: "rgba(183,121,31,0.16)",
  },
  CONFIRMED: { label: "potrjeno", color: "#2F5D42", bg: "rgba(47,93,66,0.16)" },
};

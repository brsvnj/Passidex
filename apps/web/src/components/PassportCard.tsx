import { useMemo } from "react";
import { categoryOrDefault, type FieldDefinition } from "@passidex/schema";
import { iconFor } from "../icons";
import { COPPER, FOREST, INK, LINE, PAPER } from "../theme";
import { formatValue, STATUS_META } from "../format";

export interface PassportField {
  fieldKey: string;
  value: unknown;
  status?: string;
}

export interface PassportProduct {
  name: string;
  brand?: string | null;
  passportCode: string;
  categoryKey: string;
}

function VerifiedSeal() {
  return (
    <div
      className="relative w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center shrink-0 -rotate-12"
      style={{ borderColor: COPPER, color: COPPER }}
    >
      <span
        className="text-[8px] tracking-[0.15em] font-medium text-center leading-tight"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        VERIFIED
        <br />
        EU DPP
      </span>
    </div>
  );
}

function StampGrid() {
  const cells = useMemo(
    () => Array.from({ length: 49 }, (_, i) => (i * 7 + 3) % 5 > 1),
    [],
  );
  return (
    <div className="grid grid-cols-7 gap-[2px] w-14 h-14 shrink-0">
      {cells.map((on, i) => (
        <div key={i} className={on ? "bg-current" : "bg-transparent"} />
      ))}
    </div>
  );
}

function FrameworkBadge({
  frameworkLabel,
  eta,
  isCPR,
}: {
  frameworkLabel: string;
  eta: string;
  isCPR: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[10px] tracking-wide"
      style={{
        background: isCPR ? "rgba(168,93,59,0.12)" : "rgba(47,93,66,0.12)",
        color: isCPR ? COPPER : FOREST,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {frameworkLabel} · rok {eta}
    </div>
  );
}

export function PassportCard({
  product,
  fields,
  tilt = true,
}: {
  product: PassportProduct;
  fields: PassportField[];
  tilt?: boolean;
}) {
  const cat = categoryOrDefault(product.categoryKey);
  const Icon = iconFor(cat.icon);
  const defByKey = new Map<string, FieldDefinition>(cat.fields.map((f) => [f.key, f]));

  return (
    <div
      className={`relative rounded-[4px] p-5 shadow-[0_18px_40px_-20px_rgba(24,38,32,0.5)] ${
        tilt ? "rotate-[1.5deg]" : ""
      }`}
      style={{ background: PAPER, border: `1px solid ${LINE}`, color: INK, minWidth: 280 }}
    >
      <div
        className="flex items-start justify-between border-b pb-3 mb-3"
        style={{ borderColor: LINE }}
      >
        <div>
          <p
            className="text-[10px] tracking-[0.2em] uppercase opacity-60 flex items-center gap-1.5"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <Icon size={11} /> {cat.label}
          </p>
          <h3 className="text-xl mt-1" style={{ fontFamily: "'Fraunces', serif" }}>
            {product.name}
          </h3>
        </div>
        <VerifiedSeal />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div style={{ color: FOREST }}>
          <StampGrid />
        </div>
        <div>
          <p className="text-[10px] uppercase opacity-60 tracking-wider">Koda passporta</p>
          <p className="text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {product.passportCode}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <FrameworkBadge
          frameworkLabel={cat.frameworkLabel}
          eta={cat.eta}
          isCPR={cat.framework === "CPR"}
        />
      </div>

      <div className="space-y-1.5">
        {fields.map((f) => {
          const def = defByKey.get(f.fieldKey);
          const meta = f.status ? STATUS_META[f.status] : undefined;
          return (
            <div
              key={f.fieldKey}
              className="flex items-center justify-between text-xs gap-2"
            >
              <span className="opacity-60 shrink-0">{def?.label ?? f.fieldKey}</span>
              <span className="flex items-center gap-2 text-right min-w-0">
                <span
                  className="truncate"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {formatValue(def, f.value)}
                </span>
                {meta && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-[3px] shrink-0"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] opacity-70"
        style={{ borderColor: LINE }}
      >
        <span>Proizvajalec: {product.brand || "—"}</span>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "../api";
import { COPPER, FOREST, INK, LINE, PAPER } from "../theme";
import { STATUS_META } from "../format";

const FIELD_ORDER = ["MISSING", "REQUESTED", "RECEIVED_PENDING", "CONFIRMED"];

function StatusBars({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-1.5">
      {FIELD_ORDER.filter((s) => counts[s]).map((s) => {
        const meta = STATUS_META[s];
        const pct = Math.round((counts[s] / total) * 100);
        return (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 opacity-70">{meta?.label ?? s}</span>
            <div
              className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ background: LINE }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: meta?.color ?? FOREST }}
              />
            </div>
            <span
              className="w-8 text-right"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {counts[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Analytics() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.analytics>> | null>(
    null,
  );

  useEffect(() => {
    if (open && !data) api.analytics().then(setData).catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      className="rounded-[4px] mb-6"
      style={{ background: PAPER, border: `1px solid ${LINE}` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm"
      >
        <span style={{ fontFamily: "'Fraunces', serif" }}>
          Analitika oskrbovalne verige
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && data && (
        <div className="px-4 pb-4 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider opacity-60 mb-2">
              Statusi polj
            </p>
            <StatusBars counts={data.fieldStatus} />
            <p className="text-[11px] uppercase tracking-wider opacity-60 mt-4 mb-1">
              Zahteve
            </p>
            <p className="text-xs opacity-80">
              odprte: {(data.requestStatus.SENT ?? 0) + (data.requestStatus.REMINDED ?? 0)}{" "}
              · odgovorjene: {data.requestStatus.ANSWERED ?? 0} ·{" "}
              <span style={{ color: data.overdue > 0 ? COPPER : INK }}>
                zapadle: {data.overdue}
              </span>
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider opacity-60 mb-2">
              Dobavitelji (ozka grla najprej)
            </p>
            {data.suppliers.length === 0 ? (
              <p className="text-xs opacity-60">Še ni zahtev dobaviteljem.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="opacity-60 text-left">
                    <th className="font-normal pb-1">Dobavitelj</th>
                    <th className="font-normal pb-1 text-right">Odprte</th>
                    <th className="font-normal pb-1 text-right">Zapadle</th>
                    <th className="font-normal pb-1 text-right">Odziv (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suppliers.map((s) => (
                    <tr key={s.supplierId}>
                      <td className="py-0.5">
                        {s.name}
                        {!s.hasEmail && (
                          <span className="opacity-50"> · brez e-pošte</span>
                        )}
                      </td>
                      <td className="text-right">{s.open}</td>
                      <td
                        className="text-right"
                        style={{ color: s.overdue > 0 ? COPPER : undefined }}
                      >
                        {s.overdue}
                      </td>
                      <td className="text-right">
                        {s.avgResponseHours ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data.oldestOpenRequests.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-[11px] uppercase tracking-wider opacity-60 mb-2">
                Najstarejše odprte zahteve
              </p>
              <div className="space-y-1">
                {data.oldestOpenRequests.map((r) => (
                  <div
                    key={r.requestId}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>
                      {r.productName}{" "}
                      <span className="opacity-50">· {r.supplierName}</span>
                    </span>
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: r.overdue ? COPPER : undefined,
                      }}
                    >
                      {r.ageDays} dni{r.overdue ? " · zapadlo" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

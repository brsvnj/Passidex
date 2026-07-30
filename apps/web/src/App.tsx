import { CATEGORIES } from "@passidex/schema";
import { ArrowRight, Check, Leaf, Sparkles } from "lucide-react";
import { iconFor } from "./icons";
import { BG, COPPER, FOREST, INK, LINE, PAPER } from "./theme";
import { PassportCard } from "./components/PassportCard";
import { Dashboard } from "./components/Dashboard";

const TIERS = [
  {
    name: "Starter",
    price: "€25",
    unit: "/mesec",
    desc: "Do 50 izdelkov, ena panoga, samostojen vnos.",
    features: [
      "Do 50 SKU",
      "1 panoga / okvir (ESPR ali CPR)",
      "QR generator",
      "1 uporabniški račun",
    ],
  },
  {
    name: "Growth",
    price: "€89",
    unit: "/mesec",
    desc: "Za rastoča podjetja, tudi z več panogami.",
    features: [
      "Do 500 SKU",
      "Vse panoge (ESPR + CPR)",
      "AI-pomoč pri zbiranju podatkov od dobaviteljev",
      "Večjezična podpora",
    ],
    highlight: true,
  },
  {
    name: "Scale",
    price: "€199",
    unit: "/mesec",
    desc: "Neomejeno, z integracijami.",
    features: [
      "Neomejeno SKU",
      "API / ERP integracija",
      "Neomejeno uporabnikov",
      "Prednostna podpora",
    ],
  },
];

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

export default function App() {
  return (
    <div
      style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: INK, background: BG }}
      className="min-h-screen"
    >
      {/* NAV */}
      <nav
        className="flex items-center justify-between px-6 md:px-12 py-5 border-b"
        style={{ borderColor: LINE }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-[3px] flex items-center justify-center"
            style={{ background: FOREST }}
          >
            <Leaf size={15} color={PAPER} />
          </div>
          <span className="text-lg" style={{ fontFamily: "'Fraunces', serif" }}>
            Passidex
          </span>
        </div>
        <a
          href="#dashboard"
          className="text-sm px-4 py-2 rounded-[3px] transition hover:opacity-90"
          style={{ background: INK, color: PAPER }}
        >
          Odpri nadzorno ploščo
        </a>
      </nav>

      {/* HERO */}
      <section className="px-6 md:px-12 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
        <div>
          <p
            className="text-xs tracking-[0.2em] uppercase mb-4"
            style={{ color: FOREST, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            En passport za vse panoge · ESPR + CPR
          </p>
          <h1
            className="text-4xl md:text-5xl leading-[1.1] mb-6"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Ena platforma,
            <br />
            vsaka panoga, vsak rok.
          </h1>
          <p className="text-base opacity-75 max-w-md mb-8 leading-relaxed">
            Od tekstila do baterij, od vrat do jekla — ustvari in gostuj digitalne
            potne liste izdelkov, prilagojene pravemu regulativnemu okviru (ESPR ali
            CPR) in pravemu roku. AI zbere manjkajoče podatke od tvojih dobaviteljev.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#pricing"
              className="text-sm px-5 py-3 rounded-[3px] inline-flex items-center gap-2 transition hover:opacity-90"
              style={{ background: FOREST, color: PAPER }}
            >
              Poglej cenik <ArrowRight size={14} />
            </a>
            <a href="#dashboard" className="text-sm underline opacity-70 hover:opacity-100">
              Preizkusi demo
            </a>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <PassportCard
            product={{
              name: "Tehnična jakna 3L",
              brand: "Vzorčna znamka",
              passportCode: "SI-DPP-A93F21",
              categoryKey: "textile",
            }}
            fields={[
              {
                fieldKey: "material_composition",
                value: [
                  { name: "Organski bombaž", pct: 62 },
                  { name: "Recikliran poliester", pct: 28 },
                  { name: "Elastan", pct: 10 },
                ],
                status: "CONFIRMED",
              },
              { fieldKey: "recycled_content_pct", value: 28, status: "CONFIRMED" },
              {
                fieldKey: "country_of_origin",
                value: "Portugalska",
                status: "RECEIVED_PENDING",
              },
              { fieldKey: "svhc_substances", value: null, status: "REQUESTED" },
            ]}
          />
        </div>
      </section>

      {/* CATEGORY GRID */}
      <section className="px-6 md:px-12 py-16 border-t" style={{ borderColor: LINE }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
            Panoge, ki jih pokrivamo
          </h2>
          <p className="text-sm opacity-70 mb-10">
            Vsaka kategorija ima svojo shemo podatkov in svoj rok.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {CATEGORIES.map((c) => {
              const Icon = iconFor(c.icon);
              return (
                <div
                  key={c.key}
                  className="p-4 rounded-[4px]"
                  style={{ background: PAPER, border: `1px solid ${LINE}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} style={{ color: FOREST }} />
                    <span className="text-sm" style={{ fontFamily: "'Fraunces', serif" }}>
                      {c.label}
                    </span>
                  </div>
                  <FrameworkBadge
                    frameworkLabel={c.frameworkLabel}
                    eta={c.eta}
                    isCPR={c.framework === "CPR"}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 md:px-12 py-16 border-t" style={{ borderColor: LINE }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl mb-10" style={{ fontFamily: "'Fraunces', serif" }}>
            Trije koraki do skladnosti
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                n: "01",
                t: "Izberi panogo in izdelek",
                d: "Platforma samodejno uporabi pravo shemo (ESPR ali CPR).",
              },
              {
                n: "02",
                t: "AI zbere podatke",
                d: "Sistem pošlje zahteve dobaviteljem in sestavi manjkajoče podatke.",
              },
              {
                n: "03",
                t: "Objavi passport",
                d: "QR koda gre na izdelek, podatki se posodabljajo skozi celo življenjsko dobo.",
              },
            ].map((s) => (
              <div key={s.n}>
                <p
                  className="text-3xl mb-3 opacity-25"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {s.n}
                </p>
                <h3 className="text-lg mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
                  {s.t}
                </h3>
                <p className="text-sm opacity-70 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 md:px-12 py-16 border-t" style={{ borderColor: LINE }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
            Cenik
          </h2>
          <p className="text-sm opacity-70 mb-10">
            Naročnina + €5–15 za generiranje vsakega novega passporta.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className="rounded-[4px] p-6 flex flex-col"
                style={{
                  background: t.highlight ? INK : PAPER,
                  color: t.highlight ? PAPER : INK,
                  border: `1px solid ${t.highlight ? INK : LINE}`,
                }}
              >
                <p
                  className="text-xs tracking-[0.15em] uppercase opacity-60 mb-2"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {t.name}
                </p>
                <p className="mb-1">
                  <span className="text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>
                    {t.price}
                  </span>
                  <span className="text-sm opacity-60">{t.unit}</span>
                </p>
                <p className="text-sm opacity-70 mb-5">{t.desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="text-sm flex items-start gap-2">
                      <Check
                        size={15}
                        className="mt-0.5 shrink-0"
                        style={{ color: t.highlight ? "#8FBFA0" : FOREST }}
                      />
                      <span className="opacity-85">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#dashboard"
                  className="text-sm px-4 py-2.5 rounded-[3px] text-center transition hover:opacity-90"
                  style={{
                    background: t.highlight ? PAPER : INK,
                    color: t.highlight ? INK : PAPER,
                  }}
                >
                  Preizkusi
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section id="dashboard" className="px-6 md:px-12 py-16 border-t" style={{ borderColor: LINE }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
              Nadzorna plošča
            </h2>
            <p className="text-sm opacity-70">
              Delujoč demo, povezan z zaledjem Passidex (API).
            </p>
          </div>
          <Dashboard />
        </div>
      </section>

      <footer
        className="px-6 md:px-12 py-8 border-t flex items-center justify-between text-xs opacity-60"
        style={{ borderColor: LINE }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          Passidex — DPP za vse panoge, ves EU trg
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles size={12} /> MVP demo
        </span>
      </footer>
    </div>
  );
}

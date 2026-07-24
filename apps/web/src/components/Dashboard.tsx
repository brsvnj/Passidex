import { useEffect, useState } from "react";
import { CATEGORIES, categoryOrDefault, getFieldDefinition } from "@passidex/schema";
import { Check, ChevronDown, Mail, Plus, Send, X } from "lucide-react";
import {
  api,
  getOrgId,
  setOrgId,
  type DataRequest,
  type Organization,
  type Product,
  type ProductDetail,
  type Supplier,
} from "../api";
import { COPPER, FOREST, INK, LINE, PAPER } from "../theme";
import { formatValue, STATUS_META } from "../format";
import { parseInput } from "../valueInput";

function Bar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: LINE }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: score >= 100 ? FOREST : COPPER }}
        />
      </div>
      <span
        className="text-xs w-10 text-right"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {score}%
      </span>
    </div>
  );
}

function OrgBootstrap({ onReady }: { onReady: () => void }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    api.listOrgs().then(setOrgs).catch(() => setOrgs([]));
  }, []);

  async function create() {
    if (!name.trim()) return;
    const org = await api.createOrg(name.trim());
    setOrgId(org.id);
    onReady();
  }

  return (
    <div
      className="rounded-[4px] p-6"
      style={{ background: PAPER, border: `1px solid ${LINE}` }}
    >
      <p className="text-sm mb-4 opacity-80">
        Izberi ali ustvari podjetje (najemnika), da se poveže z zaledjem Passidex.
      </p>
      {orgs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setOrgId(o.id);
                onReady();
              }}
              className="text-xs px-3 py-1.5 rounded-[3px]"
              style={{ background: INK, color: PAPER }}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ime novega podjetja"
          className="flex-1 px-3 py-2 rounded-[3px] text-sm outline-none"
          style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
        />
        <button
          onClick={create}
          className="text-sm px-4 py-2 rounded-[3px]"
          style={{ background: FOREST, color: PAPER }}
        >
          Ustvari
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="rounded-[4px] p-4 flex-1 min-w-[120px]"
      style={{ background: PAPER, border: `1px solid ${LINE}` }}
    >
      <p className="text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wider opacity-60">{label}</p>
    </div>
  );
}

const REQUEST_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "osnutek", color: "#8A8570" },
  SENT: { label: "poslano", color: "#A85D3B" },
  REMINDED: { label: "opomnjeno", color: "#B7791F" },
  ANSWERED: { label: "odgovorjeno", color: "#2F5D42" },
  CLOSED: { label: "zaprto", color: "#8A8570" },
};

function SuppliersManager({
  suppliers,
  onChange,
}: {
  suppliers: Supplier[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("sl");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createSupplier({
      name: name.trim(),
      email: email.trim() || undefined,
      language,
    });
    setName("");
    setEmail("");
    onChange();
  }

  return (
    <div
      className="rounded-[4px] mb-6"
      style={{ background: PAPER, border: `1px solid ${LINE}` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm"
      >
        <span className="inline-flex items-center gap-2">
          <Mail size={14} /> Dobavitelji ({suppliers.length})
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {suppliers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suppliers.map((s) => (
                <span
                  key={s.id}
                  className="text-xs px-2 py-1 rounded-[3px]"
                  style={{ border: `1px solid ${LINE}` }}
                >
                  {s.name}
                  <span className="opacity-50">
                    {s.email ? ` · ${s.email}` : " · brez e-pošte"} · {s.language ?? "sl"}
                  </span>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={add} className="flex flex-wrap gap-2 items-end">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ime dobavitelja"
              className="px-2 py-1.5 rounded-[3px] text-xs outline-none flex-1 min-w-[140px]"
              style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
              required
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-pošta (neobvezno)"
              className="px-2 py-1.5 rounded-[3px] text-xs outline-none flex-1 min-w-[140px]"
              style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
            />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-2 py-1.5 rounded-[3px] text-xs outline-none"
              style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
            >
              <option value="sl">sl</option>
              <option value="en">en</option>
              <option value="de">de</option>
            </select>
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-[3px]"
              style={{ background: FOREST, color: PAPER }}
            >
              Dodaj
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SendRequest({
  product,
  suppliers,
  onSent,
}: {
  product: Product;
  suppliers: Supplier[];
  onSent: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [msg, setMsg] = useState("");

  async function send() {
    if (!supplierId) return;
    try {
      await api.createRequest({ productId: product.id, supplierId });
      setPicking(false);
      setMsg("");
      onSent();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (suppliers.length === 0) {
    return (
      <p className="text-[11px] opacity-60 mt-2">
        Dodaj dobavitelja zgoraj, da lahko pošlješ zahtevo za manjkajoča polja.
      </p>
    );
  }

  return (
    <div className="mt-2">
      {!picking ? (
        <button
          onClick={() => setPicking(true)}
          className="text-[11px] px-2 py-1 rounded-[3px] inline-flex items-center gap-1"
          style={{ background: COPPER, color: PAPER }}
        >
          <Send size={11} /> Pošlji zahtevo dobavitelju
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="px-2 py-1 rounded-[3px] text-xs outline-none"
            style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={send}
            className="text-[11px] px-2 py-1 rounded-[3px]"
            style={{ background: FOREST, color: PAPER }}
          >
            Pošlji
          </button>
          <button
            onClick={() => setPicking(false)}
            className="text-[11px] opacity-60"
          >
            Prekliči
          </button>
          {msg && (
            <span className="text-[11px]" style={{ color: COPPER }}>
              {msg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  categoryKey,
  field,
  onChange,
}: {
  categoryKey: string;
  field: ProductDetail["fieldValues"][number];
  onChange: () => void;
}) {
  const def = getFieldDefinition(categoryKey, field.fieldKey);
  const meta = STATUS_META[field.status];
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    if (!def) return;
    try {
      const value = parseInput(def, raw);
      await api.manualSetField(field.id, value);
      setEditing(false);
      setRaw("");
      setErr("");
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="py-2 border-b last:border-0" style={{ borderColor: LINE }}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="opacity-70">
          {def?.label ?? field.fieldKey}
          {def?.required && <span style={{ color: COPPER }}> *</span>}
        </span>
        <span className="flex items-center gap-2">
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs">
            {formatValue(def, field.value)}
          </span>
          {meta && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-[3px]"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
              {field.needsReview ? " · pregled" : ""}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        {field.status === "RECEIVED_PENDING" && (
          <>
            <button
              onClick={async () => {
                await api.confirmField(field.id);
                onChange();
              }}
              className="text-[11px] px-2 py-1 rounded-[3px]"
              style={{ background: FOREST, color: PAPER }}
            >
              Potrdi
            </button>
            <button
              onClick={async () => {
                await api.rejectField(field.id);
                onChange();
              }}
              className="text-[11px] px-2 py-1 rounded-[3px]"
              style={{ background: "transparent", color: COPPER, border: `1px solid ${COPPER}` }}
            >
              Zavrni
            </button>
          </>
        )}
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] px-2 py-1 rounded-[3px] opacity-70 hover:opacity-100"
            style={{ border: `1px solid ${LINE}` }}
          >
            {field.status === "RECEIVED_PENDING" ? "Popravi" : "Ročni vnos"}
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            {def?.type === "enum" ? (
              <select
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="px-2 py-1 rounded-[3px] text-xs outline-none"
                style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
              >
                <option value="">—</option>
                {def.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={def?.help ?? "Vrednost"}
                className="flex-1 px-2 py-1 rounded-[3px] text-xs outline-none"
                style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
              />
            )}
            <button
              onClick={save}
              className="text-[11px] px-2 py-1 rounded-[3px]"
              style={{ background: INK, color: PAPER }}
            >
              Shrani
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setErr("");
              }}
              className="text-[11px] opacity-60"
            >
              Prekliči
            </button>
          </div>
        )}
      </div>
      {err && (
        <p className="text-[11px] mt-1" style={{ color: COPPER }}>
          {err}
        </p>
      )}
    </div>
  );
}

function ProductCard({
  product,
  suppliers,
  onDeleted,
}: {
  product: Product;
  suppliers: Supplier[];
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const cat = categoryOrDefault(product.categoryKey);

  async function load() {
    const [d, r] = await Promise.all([
      api.getProduct(product.id),
      api.listRequests(product.id),
    ]);
    setDetail(d);
    setRequests(r);
  }

  useEffect(() => {
    if (open && !detail) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const score = product.completeness?.score ?? 0;

  return (
    <div
      className="rounded-[4px]"
      style={{ background: PAPER, border: `1px solid ${LINE}` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-60">
              {cat.label} · {cat.frameworkLabel}
            </p>
            <h3 className="text-lg" style={{ fontFamily: "'Fraunces', serif" }}>
              {product.name}
            </h3>
            <p
              className="text-[11px] opacity-60"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {product.passportCode}
            </p>
          </div>
          <button
            onClick={async () => {
              await api.deleteProduct(product.id);
              onDeleted();
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: INK, color: PAPER }}
            aria-label="Odstrani"
          >
            <X size={12} />
          </button>
        </div>
        <Bar score={score} />
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 text-xs inline-flex items-center gap-1 opacity-70 hover:opacity-100"
        >
          <ChevronDown
            size={13}
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
          {open ? "Skrij polja" : "Prikaži polja"}
        </button>
      </div>

      {open && detail && (
        <div className="px-4 pb-4">
          {detail.fieldValues.map((f) => (
            <FieldRow
              key={f.id}
              categoryKey={product.categoryKey}
              field={f}
              onChange={load}
            />
          ))}

          <SendRequest product={product} suppliers={suppliers} onSent={load} />

          {requests.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: LINE }}>
              <p className="text-[11px] uppercase tracking-wider opacity-60 mb-2">
                Zahteve dobaviteljem
              </p>
              {requests.map((r) => {
                const meta = REQUEST_STATUS[r.status];
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span>
                      {r.supplier?.name ?? "—"}{" "}
                      <span className="opacity-50">
                        · {r.fields.length} polj
                        {r.reminderCount > 0 ? ` · ${r.reminderCount} opomnik(ov)` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-[3px]"
                        style={{ color: meta?.color, border: `1px solid ${LINE}` }}
                      >
                        {meta?.label ?? r.status}
                      </span>
                      {r.status !== "CLOSED" && r.status !== "ANSWERED" && (
                        <button
                          onClick={async () => {
                            await api.cancelRequest(r.id);
                            await load();
                          }}
                          className="text-[10px] opacity-60 hover:opacity-100"
                        >
                          prekliči
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const [ready, setReady] = useState(!!getOrgId());
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof api.summary>
  > | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[0].key);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    try {
      const [p, s, sup] = await Promise.all([
        api.listProducts(),
        api.summary(),
        api.listSuppliers(),
      ]);
      setProducts(p);
      setSummary(s);
      setSuppliers(sup);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runReminders() {
    const res = await api.runReminders();
    setNotice(`Opomniki: ${res.sent} poslanih (${res.processed} zapadlih).`);
    await refresh();
  }

  useEffect(() => {
    if (ready) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createProduct({
        name: name.trim(),
        brand: brand.trim() || undefined,
        categoryKey,
      });
      setName("");
      setBrand("");
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return <OrgBootstrap onReady={() => setReady(true)} />;

  return (
    <div>
      {summary && (
        <div className="flex flex-wrap gap-3 mb-6">
          <Stat label="Izdelki" value={summary.productsTotal} />
          <Stat label="Popolni" value={summary.complete} />
          <Stat label="Delni" value={summary.partial} />
          <Stat label="Čaka potrditev" value={summary.awaitingConfirmation} />
        </div>
      )}

      <SuppliersManager suppliers={suppliers} onChange={refresh} />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <p className="text-sm opacity-70">
          Dodani izdelki dobijo shemo svoje panoge; vsako polje ima status in
          zgodovino.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={runReminders}
            className="text-sm px-3 py-2.5 rounded-[3px] inline-flex items-center gap-2"
            style={{ border: `1px solid ${LINE}`, background: PAPER }}
          >
            <Mail size={15} /> Zaženi opomnike
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-sm px-4 py-2.5 rounded-[3px] inline-flex items-center gap-2"
            style={{ background: FOREST, color: PAPER }}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Prekliči" : "Dodaj izdelek"}
          </button>
        </div>
      </div>

      {notice && (
        <p className="text-sm mb-4" style={{ color: FOREST }}>
          {notice}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={addProduct}
          className="mb-8 p-5 rounded-[4px] grid md:grid-cols-2 gap-3"
          style={{ background: PAPER, border: `1px solid ${LINE}` }}
        >
          <div>
            <label className="text-xs uppercase opacity-60 tracking-wider block mb-1">
              Ime izdelka
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="npr. Vhodna vrata Modern 90"
              className="w-full px-3 py-2 rounded-[3px] text-sm outline-none"
              style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-60 tracking-wider block mb-1">
              Znamka
            </label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="npr. Tvoje podjetje"
              className="w-full px-3 py-2 rounded-[3px] text-sm outline-none"
              style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs uppercase opacity-60 tracking-wider block mb-1">
              Panoga
            </label>
            <select
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className="w-full px-3 py-2 rounded-[3px] text-sm outline-none"
              style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} — {c.frameworkLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="text-sm px-4 py-2.5 rounded-[3px]"
              style={{ background: INK, color: PAPER }}
            >
              Ustvari passport
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm mb-4" style={{ color: COPPER }}>
          {error}
        </p>
      )}

      {products.length === 0 ? (
        <div
          className="rounded-[4px] p-10 text-center"
          style={{ background: PAPER, border: `1px dashed ${LINE}` }}
        >
          <Check className="mx-auto mb-3 opacity-40" size={28} />
          <p className="text-sm opacity-70">
            Še ni izdelkov. Dodaj prvega in ustvari njegov digitalni passport.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              suppliers={suppliers}
              onDeleted={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

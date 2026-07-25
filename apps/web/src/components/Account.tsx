import { useState } from "react";
import { api, type AuthUser } from "../api";
import { COPPER, FOREST, INK, LINE, PAPER } from "../theme";

const inputStyle = { border: `1px solid ${LINE}`, background: "#F5F3EA" };
const inputCls = "w-full px-3 py-2 rounded-[3px] text-sm outline-none";

/** Full-screen reset form, reached from an emailed ?reset=<token> link. */
export function ResetPassword({
  token,
  onAuthed,
  onCancel,
}: {
  token: string;
  onAuthed: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const user = await api.resetPassword(token, password);
      onAuthed(user);
    } catch (e2) {
      setErr(
        (e2 as Error).message.includes("400")
          ? "Povezava ni veljavna ali je potekla."
          : (e2 as Error).message.replace(/^API \d+:\s*/, ""),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-[4px] p-6 max-w-md"
      style={{ background: PAPER, border: `1px solid ${LINE}`, color: INK }}
    >
      <h3 className="text-lg mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
        Nastavi novo geslo
      </h3>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Novo geslo (min. 8 znakov)"
          className={inputCls}
          style={inputStyle}
          required
        />
        {err && (
          <p className="text-sm" style={{ color: COPPER }}>
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="text-sm px-4 py-2.5 rounded-[3px] w-full disabled:opacity-50"
          style={{ background: FOREST, color: PAPER }}
        >
          {busy ? "…" : "Nastavi geslo in se prijavi"}
        </button>
      </form>
      <button
        onClick={onCancel}
        className="text-xs underline opacity-70 hover:opacity-100 mt-3"
      >
        Nazaj na prijavo
      </button>
    </div>
  );
}

/** Inline change-password form for a logged-in user. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    try {
      await api.changePassword(current, next);
      setMsg("Geslo spremenjeno.");
      setCurrent("");
      setNext("");
      setOpen(false);
    } catch (e2) {
      setErr((e2 as Error).message.replace(/^API \d+:\s*/, ""));
    }
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        {msg && (
          <span className="text-xs" style={{ color: FOREST }}>
            {msg}
          </span>
        )}
        <button
          onClick={() => {
            setOpen(true);
            setMsg("");
          }}
          className="underline opacity-70 hover:opacity-100"
        >
          Spremeni geslo
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="Trenutno geslo"
        className="px-2 py-1 rounded-[3px] text-xs outline-none"
        style={inputStyle}
        required
      />
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="Novo (min. 8)"
        className="px-2 py-1 rounded-[3px] text-xs outline-none"
        style={inputStyle}
        required
      />
      <button
        type="submit"
        className="text-xs px-2 py-1 rounded-[3px]"
        style={{ background: FOREST, color: PAPER }}
      >
        Shrani
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs opacity-60">
        Prekliči
      </button>
      {err && (
        <span className="text-xs" style={{ color: COPPER }}>
          {err}
        </span>
      )}
    </form>
  );
}

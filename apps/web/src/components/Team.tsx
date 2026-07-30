import { useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { api, type AuthUser, type Invitation, type TeamMember } from "../api";
import { COPPER, FOREST, INK, LINE, PAPER } from "../theme";

export function TeamManager({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const canManage = role === "owner" || role === "admin";

  async function load() {
    const [m, i] = await Promise.all([
      api.teamMembers(),
      canManage ? api.teamInvitations() : Promise.resolve([]),
    ]);
    setMembers(m);
    setInvites(i);
  }

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.invite(email.trim(), inviteRole);
      setMsg(`Povabilo poslano na ${email.trim()}.`);
      setEmail("");
      await load();
    } catch (e2) {
      setErr((e2 as Error).message.replace(/^API \d+:\s*/, ""));
    }
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
          <Users size={14} /> Ekipa ({members.length})
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-1 mb-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span>
                  {m.name ?? m.email}{" "}
                  <span className="opacity-50">· {m.email}</span>
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-[3px]"
                  style={{ border: `1px solid ${LINE}` }}
                >
                  {m.role}
                </span>
              </div>
            ))}
          </div>

          {canManage ? (
            <>
              <form onSubmit={sendInvite} className="flex flex-wrap gap-2 items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e-pošta sodelavca"
                  className="px-2 py-1.5 rounded-[3px] text-xs outline-none flex-1 min-w-[180px]"
                  style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="px-2 py-1.5 rounded-[3px] text-xs outline-none"
                  style={{ border: `1px solid ${LINE}`, background: "#F5F3EA" }}
                >
                  <option value="member">član</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 rounded-[3px]"
                  style={{ background: FOREST, color: PAPER }}
                >
                  Povabi
                </button>
              </form>
              {msg && (
                <p className="text-xs mt-2" style={{ color: FOREST }}>
                  {msg}
                </p>
              )}
              {err && (
                <p className="text-xs mt-2" style={{ color: COPPER }}>
                  {err}
                </p>
              )}

              {invites.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider opacity-60 mb-1">
                    Čakajoča povabila
                  </p>
                  {invites.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <span>
                        {i.email} <span className="opacity-50">· {i.role}</span>
                      </span>
                      <button
                        onClick={async () => {
                          await api.revokeInvitation(i.id);
                          await load();
                        }}
                        className="text-[11px] opacity-60 hover:opacity-100"
                        style={{ color: COPPER }}
                      >
                        prekliči
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs opacity-60">
              Za povabila sodelavcev potrebuješ vlogo owner ali admin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AcceptInvite({
  token,
  onAuthed,
  onCancel,
}: {
  token: string;
  onAuthed: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const [info, setInfo] = useState<{ email: string; orgName: string; role: string } | null>(
    null,
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .describeInvite(token)
      .then(setInfo)
      .catch(() => setLoadErr("Povabilo ni veljavno ali je poteklo."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const user = await api.acceptInvite(token, { name: name.trim() || undefined, password });
      onAuthed(user);
    } catch (e2) {
      setErr((e2 as Error).message.replace(/^API \d+:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { border: `1px solid ${LINE}`, background: "#F5F3EA" };

  if (loadErr) {
    return (
      <div
        className="rounded-[4px] p-6 max-w-md"
        style={{ background: PAPER, border: `1px solid ${LINE}` }}
      >
        <p className="text-sm mb-3" style={{ color: COPPER }}>
          {loadErr}
        </p>
        <button onClick={onCancel} className="text-sm underline">
          Nazaj na prijavo
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-[4px] p-6 max-w-md"
      style={{ background: PAPER, border: `1px solid ${LINE}`, color: INK }}
    >
      <h3 className="text-lg mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
        Pridruži se ekipi
      </h3>
      {info ? (
        <p className="text-sm opacity-75 mb-4">
          Povabljen(a) si v <strong>{info.orgName}</strong> kot {info.role} ({info.email}).
          Nastavi geslo za svoj račun.
        </p>
      ) : (
        <p className="text-sm opacity-60 mb-4">Nalagam…</p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tvoje ime (neobvezno)"
          className="w-full px-3 py-2 rounded-[3px] text-sm outline-none"
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Geslo (min. 8 znakov)"
          className="w-full px-3 py-2 rounded-[3px] text-sm outline-none"
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
          disabled={busy || !info}
          className="text-sm px-4 py-2.5 rounded-[3px] w-full disabled:opacity-50"
          style={{ background: FOREST, color: PAPER }}
        >
          {busy ? "…" : "Ustvari račun in se pridruži"}
        </button>
      </form>
    </div>
  );
}

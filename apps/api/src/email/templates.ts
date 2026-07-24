/**
 * Localized supplier-request email templates. Language is chosen from the
 * supplier's stored `language` (BCP-47), falling back to English. Adding a
 * language = adding one entry to STRINGS.
 */

export interface RequestEmailInput {
  language?: string | null;
  supplierName: string;
  orgName: string;
  productName: string;
  fields: { label: string; help?: string; required: boolean }[];
  replyTo: string;
  dueDateISO?: string;
  isReminder: boolean;
}

export interface RenderedEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
}

type Lang = "sl" | "en" | "de";

const STRINGS: Record<Lang, Record<string, string>> = {
  sl: {
    subjectNew: "Zahteva za podatke o izdelku: {product}",
    subjectReminder: "Opomnik — zahteva za podatke o izdelku: {product}",
    greeting: "Spoštovani {supplier},",
    intro:
      "{org} pripravlja digitalni potni list izdelka (DPP) za »{product}« in potrebuje naslednje podatke, ki jih zagotavljate vi:",
    reminderIntro:
      "To je vljuden opomnik: {org} še vedno čaka na naslednje podatke za »{product}«:",
    required: "obvezno",
    optional: "neobvezno",
    reply:
      "Odgovorite na to sporočilo (lahko priložite certifikat, PDF ali Excel). Podatke bomo obdelali samodejno, končno vrednost pa vedno ročno potrdimo.",
    due: "Prosimo za odgovor do {date}.",
    thanks: "Hvala za sodelovanje.",
    signature: "Ekipa {org} · prek Passidex",
  },
  en: {
    subjectNew: "Product data request: {product}",
    subjectReminder: "Reminder — product data request: {product}",
    greeting: "Dear {supplier},",
    intro:
      "{org} is preparing a Digital Product Passport (DPP) for “{product}” and needs the following data that you provide:",
    reminderIntro:
      "A friendly reminder: {org} is still waiting for the following data for “{product}”:",
    required: "required",
    optional: "optional",
    reply:
      "Simply reply to this email (you may attach a certificate, PDF or Excel). We process replies automatically, but always confirm the final value manually.",
    due: "Please reply by {date}.",
    thanks: "Thank you for your cooperation.",
    signature: "The {org} team · via Passidex",
  },
  de: {
    subjectNew: "Anfrage zu Produktdaten: {product}",
    subjectReminder: "Erinnerung — Anfrage zu Produktdaten: {product}",
    greeting: "Sehr geehrte(r) {supplier},",
    intro:
      "{org} erstellt einen digitalen Produktpass (DPP) für „{product}“ und benötigt die folgenden von Ihnen bereitgestellten Daten:",
    reminderIntro:
      "Eine freundliche Erinnerung: {org} wartet noch auf die folgenden Daten für „{product}“:",
    required: "erforderlich",
    optional: "optional",
    reply:
      "Antworten Sie einfach auf diese E-Mail (Sie können ein Zertifikat, PDF oder Excel anhängen). Wir verarbeiten Antworten automatisch, bestätigen den endgültigen Wert jedoch stets manuell.",
    due: "Bitte antworten Sie bis zum {date}.",
    thanks: "Vielen Dank für Ihre Zusammenarbeit.",
    signature: "Das {org}-Team · über Passidex",
  },
};

function pickLang(language?: string | null): Lang {
  const base = (language ?? "").slice(0, 2).toLowerCase();
  if (base === "sl" || base === "en" || base === "de") return base;
  return "en";
}

function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function formatDate(iso: string | undefined, lang: Lang): string {
  if (!iso) return "";
  const locale = lang === "sl" ? "sl-SI" : lang === "de" ? "de-DE" : "en-GB";
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function renderRequestEmail(input: RequestEmailInput): RenderedEmail {
  const lang = pickLang(input.language);
  const t = STRINGS[lang];
  const vars = {
    supplier: input.supplierName,
    org: input.orgName,
    product: input.productName,
    date: formatDate(input.dueDateISO, lang),
  };

  const subject = fmt(input.isReminder ? t.subjectReminder : t.subjectNew, vars);
  const intro = fmt(input.isReminder ? t.reminderIntro : t.intro, vars);

  const fieldLine = (f: RequestEmailInput["fields"][number]) => {
    const tag = f.required ? t.required : t.optional;
    return { label: f.label, tag, help: f.help };
  };
  const lines = input.fields.map(fieldLine);

  const textBody = [
    fmt(t.greeting, vars),
    "",
    intro,
    "",
    ...lines.map(
      (l) => `• ${l.label} (${l.tag})${l.help ? ` — ${l.help}` : ""}`,
    ),
    "",
    t.reply,
    vars.date ? fmt(t.due, vars) : "",
    "",
    t.thanks,
    fmt(t.signature, vars),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const htmlBody = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#182620;max-width:560px">
    <p>${escapeHtml(fmt(t.greeting, vars))}</p>
    <p>${escapeHtml(intro)}</p>
    <ul>
      ${lines
        .map(
          (l) =>
            `<li><strong>${escapeHtml(l.label)}</strong> <em style="color:#8A8570">(${escapeHtml(
              l.tag,
            )})</em>${l.help ? `<br><span style="color:#5b5b4f;font-size:13px">${escapeHtml(l.help)}</span>` : ""}</li>`,
        )
        .join("")}
    </ul>
    <p>${escapeHtml(t.reply)}</p>
    ${vars.date ? `<p><strong>${escapeHtml(fmt(t.due, vars))}</strong></p>` : ""}
    <p>${escapeHtml(t.thanks)}<br>${escapeHtml(fmt(t.signature, vars))}</p>
  </div>`.trim();

  return { subject, textBody, htmlBody };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

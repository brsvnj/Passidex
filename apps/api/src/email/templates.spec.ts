import { describe, expect, it } from "vitest";
import { renderRequestEmail, type RequestEmailInput } from "./templates";

const base: RequestEmailInput = {
  language: "sl",
  supplierName: "Dobavitelj d.o.o.",
  orgName: "Passidex Demo",
  productName: "Tehnična jakna",
  fields: [
    { label: "Sestava materialov", help: "v %", required: true },
    { label: "Država porekla", required: false },
  ],
  replyTo: "req-abc@inbound.passidex.eu",
  dueDateISO: "2026-08-01T00:00:00.000Z",
  isReminder: false,
};

describe("renderRequestEmail", () => {
  it("builds a Slovenian request naming the product and fields", () => {
    const out = renderRequestEmail(base);
    expect(out.subject).toContain("Tehnična jakna");
    expect(out.textBody).toContain("Sestava materialov");
    expect(out.textBody).toContain("obvezno");
    expect(out.textBody).toContain("neobvezno");
    expect(out.htmlBody).toContain("<ul>");
  });

  it("uses a distinct reminder subject", () => {
    const normal = renderRequestEmail(base).subject;
    const reminder = renderRequestEmail({ ...base, isReminder: true }).subject;
    expect(reminder).not.toBe(normal);
    expect(reminder.toLowerCase()).toContain("opomnik");
  });

  it("localises to English and German", () => {
    expect(renderRequestEmail({ ...base, language: "en" }).textBody).toContain(
      "required",
    );
    expect(renderRequestEmail({ ...base, language: "de" }).textBody).toContain(
      "erforderlich",
    );
  });

  it("falls back to English for an unknown language", () => {
    const out = renderRequestEmail({ ...base, language: "fr" });
    expect(out.textBody).toContain("required");
  });
});

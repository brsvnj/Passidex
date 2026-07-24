import { randomBytes } from "node:crypto";
import { passportPrefix } from "@passidex/schema";

/**
 * Mint an internal passport code, e.g. "SI-DPP-A93F21" (ESPR) or
 * "CPR-DPP-00417" (construction). When a product also has a GTIN, the GTIN is
 * the primary GS1 identifier; this code is Passidex's own stable handle.
 */
export function generatePassportCode(categoryKey: string): string {
  const prefix = passportPrefix(categoryKey);
  const suffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `${prefix}-DPP-${suffix}`;
}

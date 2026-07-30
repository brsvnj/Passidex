import type { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { SESSION_COOKIE } from "./jwt-auth.guard";

export function sessionCookieOptions(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.get("COOKIE_SECURE") === "true",
    path: "/",
  };
}

/** Parse JWT_EXPIRES like "7d" / "24h" into milliseconds (default 7 days). */
export function sessionMaxAgeMs(config: ConfigService): number {
  const raw = config.get<string>("JWT_EXPIRES") || "7d";
  const m = raw.match(/^(\d+)([dhm])$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { d: 86400, h: 3600, m: 60 }[m[2]] ?? 86400;
  return n * unit * 1000;
}

export function setSessionCookie(
  res: Response,
  token: string,
  config: ConfigService,
): void {
  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(config),
    maxAge: sessionMaxAgeMs(config),
  });
}

export function clearSessionCookie(res: Response, config: ConfigService): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, uniqEmail } from "./helpers";

// Rate limiting is disabled for the rest of the e2e suite; this file re-enables
// it just for itself and restores the flag afterwards.
describe("rate limiting (e2e)", () => {
  let app: INestApplication;
  const prev = process.env.DISABLE_THROTTLE;

  beforeAll(async () => {
    process.env.DISABLE_THROTTLE = "false";
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.DISABLE_THROTTLE = prev;
  });

  it("returns 429 after too many login attempts (limit 10/min)", async () => {
    const email = uniqEmail();
    const server = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(server)
        .post("/api/auth/login")
        .send({ email, password: "whatever12" });
      statuses.push(res.status);
      if (res.status === 429) break;
    }
    expect(statuses).toContain(429);
    // The first attempts are allowed (401 for bad credentials) before the cap.
    expect(statuses[0]).toBe(401);
  });
});

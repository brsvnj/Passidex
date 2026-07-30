import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createApp, registerAgent, uniqEmail } from "./helpers";

describe("password reset (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(email: string): Promise<string> {
    const row = await prisma.passwordReset.findFirst({
      where: { user: { email: email.toLowerCase() }, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new Error("no reset token");
    return row.token;
  }

  it("forgot → reset → login with the new password", async () => {
    const { email } = await registerAgent(app); // password: password123
    const server = app.getHttpServer();

    await request(server)
      .post("/api/auth/forgot-password")
      .send({ email })
      .expect(201);

    const token = await tokenFor(email);
    const resetAgent = request.agent(server);
    const reset = await resetAgent
      .post("/api/auth/reset-password")
      .send({ token, password: "new-password-1" })
      .expect(201);
    expect(reset.body.email).toBe(email);
    // Reset logs the user in.
    await resetAgent.get("/api/auth/me").expect(200);

    // Old password no longer works; new one does.
    const login = request.agent(server);
    await login
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(401);
    await login
      .post("/api/auth/login")
      .send({ email, password: "new-password-1" })
      .expect(201);
  });

  it("rejects a reused or invalid token", async () => {
    const { email } = await registerAgent(app);
    const server = app.getHttpServer();
    await request(server).post("/api/auth/forgot-password").send({ email }).expect(201);
    const token = await tokenFor(email);

    await request(server)
      .post("/api/auth/reset-password")
      .send({ token, password: "changed-once" })
      .expect(201);
    // Same token again → rejected.
    await request(server)
      .post("/api/auth/reset-password")
      .send({ token, password: "changed-twice" })
      .expect(400);
    await request(server)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", password: "whatever12" })
      .expect(400);
  });

  it("does not reveal whether an email exists", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email: uniqEmail() })
      .expect(201)
      .expect({ ok: true });
  });

  it("lets a logged-in user change their password", async () => {
    const { agent, email } = await registerAgent(app);
    await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "wrong", newPassword: "irrelevant-1" })
      .expect(400);
    await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "password123", newPassword: "brand-new-2" })
      .expect(201);

    const login = request.agent(app.getHttpServer());
    await login
      .post("/api/auth/login")
      .send({ email, password: "brand-new-2" })
      .expect(201);
  });
});

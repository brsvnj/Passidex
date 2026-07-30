import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, registerAgent, uniqEmail } from "./helpers";

describe("auth (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("register issues a session and me returns the user", async () => {
    const { agent, email, user } = await registerAgent(app);
    expect(user.email).toBe(email);
    expect(user.role).toBe("owner");
    expect(user.orgId).toBeTruthy();

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.email).toBe(email);
  });

  it("rejects unauthenticated access", async () => {
    await request(app.getHttpServer()).get("/api/products").expect(401);
  });

  it("logout clears the session", async () => {
    const { agent } = await registerAgent(app);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").send({}).expect(201);
    await agent.get("/api/auth/me").expect(401);
  });

  it("login works and rejects bad credentials", async () => {
    const email = uniqEmail();
    const agent = request.agent(app.getHttpServer());
    await agent
      .post("/api/auth/register")
      .send({ orgName: "Org", email, password: "password123" })
      .expect(201);
    await agent.post("/api/auth/logout").send({}).expect(201);

    await agent
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
    await agent
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(201);
    await agent.get("/api/auth/me").expect(200);
  });

  it("rejects duplicate registration", async () => {
    const { email } = await registerAgent(app);
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ orgName: "Other", email, password: "password123" })
      .expect(409);
  });
});

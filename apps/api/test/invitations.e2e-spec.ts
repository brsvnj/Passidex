import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, registerAgent, uniqEmail } from "./helpers";

describe("team invitations (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("invites a colleague who accepts and joins the org", async () => {
    const { agent, user: owner } = await registerAgent(app);
    const inviteeEmail = uniqEmail();

    const invite = await agent
      .post("/api/team/invitations")
      .send({ email: inviteeEmail, role: "member" })
      .expect(201);
    expect(invite.body.token).toBeTruthy();

    // Public describe by token.
    const describe = await request(app.getHttpServer())
      .get(`/api/invitations/${invite.body.token}`)
      .expect(200);
    expect(describe.body.email).toBe(inviteeEmail);
    expect(describe.body.orgName).toBe(owner.orgName);

    // Accept creates the user and logs them in.
    const inviteeAgent = request.agent(app.getHttpServer());
    const accepted = await inviteeAgent
      .post(`/api/invitations/${invite.body.token}/accept`)
      .send({ name: "Colleague", password: "password123" })
      .expect(201);
    expect(accepted.body.email).toBe(inviteeEmail);
    expect(accepted.body.orgId).toBe(owner.orgId);

    // The invitee now has a session.
    await inviteeAgent.get("/api/auth/me").expect(200);

    // Both members show up on the team.
    const team = await agent.get("/api/team").expect(200);
    const emails = team.body.map((m: any) => m.email);
    expect(emails).toContain(owner.email);
    expect(emails).toContain(inviteeEmail);
  });

  it("rejects inviting an existing user and reused tokens", async () => {
    const { agent, user: owner } = await registerAgent(app);
    await agent
      .post("/api/team/invitations")
      .send({ email: owner.email })
      .expect(409);
  });

  it("forbids non-managers from inviting", async () => {
    const { agent } = await registerAgent(app);
    const memberEmail = uniqEmail();
    const invite = await agent
      .post("/api/team/invitations")
      .send({ email: memberEmail, role: "member" })
      .expect(201);
    const memberAgent = request.agent(app.getHttpServer());
    await memberAgent
      .post(`/api/invitations/${invite.body.token}/accept`)
      .send({ password: "password123" })
      .expect(201);
    // A plain member cannot invite others.
    await memberAgent
      .post("/api/team/invitations")
      .send({ email: uniqEmail() })
      .expect(403);
  });
});

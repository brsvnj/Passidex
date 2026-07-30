import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createApp, registerAgent } from "./helpers";

describe("tenant isolation (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("keeps each organization's products private", async () => {
    const a = await registerAgent(app);
    const b = await registerAgent(app);

    const productA = await a.agent
      .post("/api/products")
      .send({ name: "A only", categoryKey: "textile" })
      .expect(201);

    // B lists nothing from A.
    const listB = await b.agent.get("/api/products").expect(200);
    expect(listB.body.find((p: any) => p.id === productA.body.id)).toBeUndefined();

    // B cannot fetch A's product directly.
    await b.agent.get(`/api/products/${productA.body.id}`).expect(404);

    // A still sees it.
    const listA = await a.agent.get("/api/products").expect(200);
    expect(listA.body.find((p: any) => p.id === productA.body.id)).toBeTruthy();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createApp, registerAgent } from "./helpers";

describe("field history (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("records who/when/what and is tenant-scoped", async () => {
    const a = await registerAgent(app);
    const product = await a.agent
      .post("/api/products")
      .send({ name: "Jakna", categoryKey: "textile" })
      .expect(201);
    const detail = await a.agent
      .get(`/api/products/${product.body.id}`)
      .expect(200);
    const field = detail.body.fieldValues.find(
      (f: any) => f.fieldKey === "country_of_origin",
    );

    await a.agent
      .post(`/api/field-values/${field.id}/manual`)
      .send({ value: "Portugalska" })
      .expect(201);

    const history = await a.agent
      .get(`/api/field-values/${field.id}/history`)
      .expect(200);
    expect(history.body.length).toBeGreaterThanOrEqual(1);
    const last = history.body[history.body.length - 1];
    expect(last.toStatus).toBe("CONFIRMED");
    expect(last.actorType).toBe("USER");
    expect(last.actorLabel).toBeTruthy();
    expect(last.newValue).toBe("Portugalska");

    // Another org cannot read this field's history.
    const b = await registerAgent(app);
    await b.agent.get(`/api/field-values/${field.id}/history`).expect(404);
  });
});

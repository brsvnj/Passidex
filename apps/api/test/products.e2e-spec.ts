import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, registerAgent, type Agent } from "./helpers";

describe("product lifecycle (e2e)", () => {
  let app: INestApplication;
  let agent: Agent;

  beforeAll(async () => {
    app = await createApp();
    ({ agent } = await registerAgent(app));
  });
  afterAll(async () => {
    await app.close();
  });

  it("seeds MISSING fields, confirms via manual entry, and exports a DPP", async () => {
    const created = await agent
      .post("/api/products")
      .send({ name: "Vhodna vrata Modern 90", categoryKey: "construction_doors" })
      .expect(201);
    const productId = created.body.id;
    expect(created.body.passportCode).toMatch(/^CPR-DPP-/);

    let detail = await agent.get(`/api/products/${productId}`).expect(200);
    expect(detail.body.completeness.score).toBe(0);
    expect(detail.body.fieldValues.every((f: any) => f.status === "MISSING")).toBe(true);

    const byKey = (key: string) =>
      detail.body.fieldValues.find((f: any) => f.fieldKey === key).id;

    await agent
      .post(`/api/field-values/${byKey("dop_number")}/manual`)
      .send({ value: "DoP-2026-00417" })
      .expect(201);
    await agent
      .post(`/api/field-values/${byKey("epd_reference")}/manual`)
      .send({ value: "EPD-SI-00982" })
      .expect(201);
    await agent
      .post(`/api/field-values/${byKey("gwp_a1a3")}/manual`)
      .send({ value: { amount: 38, unit: "kg CO₂e/kos" } })
      .expect(201);
    await agent
      .post(`/api/field-values/${byKey("ce_marking")}/manual`)
      .send({ value: "CE 1234-CPR-2026" })
      .expect(201);

    detail = await agent.get(`/api/products/${productId}`).expect(200);
    expect(detail.body.completeness.score).toBe(100);

    const passport = await agent
      .get(`/api/products/${productId}/passport`)
      .expect(200);
    expect(passport.body.gs1DigitalLink).toContain("/dpp/");
    expect(passport.body.compliance.complete).toBe(true);
    // dppPath projection: gwp maps under carbon.gwpA1A3
    expect(passport.body.data.carbon.gwpA1A3).toEqual({
      amount: 38,
      unit: "kg CO₂e/kos",
    });
    expect(passport.body.data.compliance.declarationOfPerformance).toBe(
      "DoP-2026-00417",
    );
  });

  it("serves a tenant-scoped SVG QR of the passport", async () => {
    const created = await agent
      .post("/api/products")
      .send({ name: "QR izdelek", categoryKey: "textile" })
      .expect(201);

    const qr = await agent
      .get(`/api/products/${created.body.id}/qr`)
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (c: Buffer) => (data += c.toString()));
        res.on("end", () => cb(null, data));
      })
      .expect(200)
      .expect("Content-Type", /image\/svg\+xml/);
    expect(qr.body as unknown as string).toContain("<svg");

    const other = await registerAgent(app);
    await other.agent.get(`/api/products/${created.body.id}/qr`).expect(404);
  });

  it("rejects an invalid value against the field type", async () => {
    const created = await agent
      .post("/api/products")
      .send({ name: "Jakna", categoryKey: "textile" })
      .expect(201);
    const detail = await agent.get(`/api/products/${created.body.id}`).expect(200);
    const pctField = detail.body.fieldValues.find(
      (f: any) => f.fieldKey === "recycled_content_pct",
    );
    await agent
      .post(`/api/field-values/${pctField.id}/manual`)
      .send({ value: 150 })
      .expect(400);
  });

  it("requests supplier data and processes an inbound reply", async () => {
    const product = await agent
      .post("/api/products")
      .send({ name: "EV modul", categoryKey: "batteries" })
      .expect(201);
    const supplier = await agent
      .post("/api/suppliers")
      .send({ name: "Cell Co", email: "cells@example.test", language: "en" })
      .expect(201);

    const req = await agent
      .post("/api/data-requests")
      .send({ productId: product.body.id, supplierId: supplier.body.id })
      .expect(201);
    expect(req.body.status).toBe("SENT");
    expect(req.body.replyToAddress).toMatch(/^req-.*@/);

    // Fields covered by the request move to REQUESTED.
    const detail = await agent.get(`/api/products/${product.body.id}`).expect(200);
    const requested = detail.body.fieldValues.filter(
      (f: any) => f.status === "REQUESTED",
    );
    expect(requested.length).toBeGreaterThan(0);

    // Inbound webhook is public and matches on the reply-to address.
    await request(app.getHttpServer())
      .post("/api/inbound/postmark")
      .send({
        FromFull: { Email: "cells@example.test" },
        ToFull: [{ Email: req.body.replyToAddress }],
        Subject: "Re: data",
        TextBody: "Cell chemistry is Li-ion NMC.",
        Attachments: [],
      })
      .expect(201);

    const after = await agent
      .get(`/api/data-requests/${req.body.id}`)
      .expect(200);
    expect(after.body.status).toBe("ANSWERED");
  });
});

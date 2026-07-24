/**
 * Passidex seed — creates a demo tenant with products across ESPR and CPR,
 * seeds their field values, and walks a few fields through the status lifecycle
 * so the dashboard and review queue have realistic data.
 */
import {
  ActorType,
  FieldSource,
  FieldStatus,
  PrismaClient,
} from "@prisma/client";
import { fieldsOf, passportPrefix, SCHEMA_VERSION } from "@passidex/schema";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function code(categoryKey: string): string {
  return `${passportPrefix(categoryKey)}-DPP-${randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 6)}`;
}

async function createProduct(
  orgId: string,
  name: string,
  brand: string,
  categoryKey: string,
) {
  const product = await prisma.product.create({
    data: {
      orgId,
      name,
      brand,
      categoryKey,
      schemaVersion: SCHEMA_VERSION,
      passportCode: code(categoryKey),
    },
  });
  await prisma.fieldValue.createMany({
    data: fieldsOf(categoryKey).map((f) => ({
      productId: product.id,
      fieldKey: f.key,
      status: FieldStatus.MISSING,
    })),
    skipDuplicates: true,
  });
  return product;
}

/** Move a field into a status and record the audit event (seed-only helper). */
async function setField(
  productId: string,
  fieldKey: string,
  status: FieldStatus,
  value: unknown,
  opts: {
    source?: FieldSource;
    confidence?: number;
    needsReview?: boolean;
    actorType?: ActorType;
  } = {},
) {
  const fv = await prisma.fieldValue.findFirst({ where: { productId, fieldKey } });
  if (!fv) return;
  const updated = await prisma.fieldValue.update({
    where: { id: fv.id },
    data: {
      status,
      value: value as never,
      source: opts.source ?? null,
      confidence: opts.confidence ?? null,
      needsReview: opts.needsReview ?? false,
    },
  });
  await prisma.fieldEvent.create({
    data: {
      fieldValueId: updated.id,
      actorType: opts.actorType ?? ActorType.SYSTEM,
      fromStatus: fv.status,
      toStatus: status,
      newValue: value as never,
      note: "seed",
    },
  });
}

async function main() {
  // Clean slate for the demo org.
  const existing = await prisma.organization.findFirst({
    where: { name: "Demo d.o.o." },
  });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  const org = await prisma.organization.create({
    data: {
      name: "Demo d.o.o.",
      users: { create: { email: "demo@passidex.eu", name: "Demo uporabnik" } },
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      orgId: org.id,
      name: "Tkanine Kranj d.o.o.",
      email: "info@tkanine-kranj.example",
      language: "sl",
    },
  });

  // 1) Textile — mix of confirmed, pending (needs review), requested, missing.
  const jacket = await createProduct(
    org.id,
    "Tehnična jakna 3L",
    "Vzorčna znamka",
    "textile",
  );
  await prisma.component.create({
    data: {
      productId: jacket.id,
      supplierId: supplier.id,
      name: "Zunanja tkanina",
      note: "3-slojni laminat",
    },
  });
  await setField(
    jacket.id,
    "material_composition",
    FieldStatus.CONFIRMED,
    [
      { name: "Organski bombaž", pct: 62 },
      { name: "Recikliran poliester", pct: 28 },
      { name: "Elastan", pct: 10 },
    ],
    { source: FieldSource.MANUAL, actorType: ActorType.USER },
  );
  await setField(jacket.id, "recycled_content_pct", FieldStatus.CONFIRMED, 28, {
    source: FieldSource.MANUAL,
    actorType: ActorType.USER,
  });
  // Pending, high confidence — clean "čaka potrditev".
  await setField(
    jacket.id,
    "country_of_origin",
    FieldStatus.RECEIVED_PENDING,
    "Portugalska",
    { source: FieldSource.AI_EXTRACTED, confidence: 0.92 },
  );
  // Pending, low confidence — flagged needs review.
  await setField(
    jacket.id,
    "svhc_substances",
    FieldStatus.RECEIVED_PENDING,
    "Brez SVHC > 0,1 %",
    { source: FieldSource.AI_EXTRACTED, confidence: 0.41, needsReview: true },
  );

  // 2) Battery — one requested, rest missing.
  const battery = await createProduct(
    org.id,
    "EV baterijski modul 75",
    "Vzorčna znamka",
    "batteries",
  );
  await setField(battery.id, "cell_chemistry", FieldStatus.REQUESTED, null);

  // 3) Construction door — fully confirmed (complete passport).
  const door = await createProduct(
    org.id,
    "Vhodna vrata Modern 90",
    "Vzorčna znamka",
    "construction_doors",
  );
  await setField(door.id, "dop_number", FieldStatus.CONFIRMED, "DoP-2026-00417", {
    source: FieldSource.MANUAL,
    actorType: ActorType.USER,
  });
  await setField(door.id, "epd_reference", FieldStatus.CONFIRMED, "EPD-SI-00982", {
    source: FieldSource.MANUAL,
    actorType: ActorType.USER,
  });
  await setField(
    door.id,
    "gwp_a1a3",
    FieldStatus.CONFIRMED,
    { amount: 38, unit: "kg CO₂e/kos" },
    { source: FieldSource.MANUAL, actorType: ActorType.USER },
  );
  await setField(
    door.id,
    "ce_marking",
    FieldStatus.CONFIRMED,
    "CE 1234-CPR-2026",
    { source: FieldSource.MANUAL, actorType: ActorType.USER },
  );

  // eslint-disable-next-line no-console
  console.log(
    `Seeded org "${org.name}" (id ${org.id}) with 3 products. Use header X-Org-Id: ${org.id}`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

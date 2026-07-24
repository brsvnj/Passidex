import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActorType,
  FieldSource,
  FieldStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  computeNeedsReview,
  validateFieldValue,
} from "./field-status.util";

export interface Actor {
  type: ActorType;
  id?: string;
}

/**
 * The field-status state machine — the heart of Phase 1.
 *
 *   MISSING ──request──▶ REQUESTED ──propose──▶ RECEIVED_PENDING ──confirm──▶ CONFIRMED
 *                                                     │ reject ▲                  │
 *                                                     └────────┘                  │
 *                                                (back to REQUESTED/MISSING)  update ▼
 *
 * Every transition writes an append-only FieldEvent (who / when / source /
 * before / after). AI proposals never auto-confirm — a user always confirms.
 */
@Injectable()
export class FieldValueService {
  constructor(private readonly prisma: PrismaService) {}

  /** All field values for a product, oldest events summarised elsewhere. */
  listForProduct(productId: string) {
    return this.prisma.fieldValue.findMany({
      where: { productId },
      orderBy: { fieldKey: "asc" },
    });
  }

  /** Full history of a single field value. */
  async history(fieldValueId: string) {
    await this.getOrThrow(fieldValueId);
    return this.prisma.fieldEvent.findMany({
      where: { fieldValueId },
      orderBy: { at: "asc" },
    });
  }

  /** The org-wide review queue: everything waiting for a human decision. */
  pendingForOrg(orgId: string) {
    return this.prisma.fieldValue.findMany({
      where: {
        status: FieldStatus.RECEIVED_PENDING,
        product: { orgId },
      },
      include: { product: { select: { id: true, name: true, categoryKey: true } } },
      orderBy: [{ needsReview: "desc" }, { updatedAt: "asc" }],
    });
  }

  // -------------------------------------------------------------- transitions

  /** MISSING → REQUESTED. Attach a data request if one is driving it. */
  async request(
    fieldValueId: string,
    opts: { requestId?: string; actor: Actor; note?: string },
  ) {
    const fv = await this.getOrThrow(fieldValueId);
    this.assertFrom(fv.status, [FieldStatus.MISSING], "request");
    return this.transition(fv, {
      toStatus: FieldStatus.REQUESTED,
      data: { currentRequestId: opts.requestId ?? null },
      actor: opts.actor,
      note: opts.note,
      sourceRef: opts.requestId,
    });
  }

  /**
   * Any state → RECEIVED_PENDING. Used by AI extraction and by supplier-typed
   * answers. Sets needsReview when confidence is low or the value is ambiguous.
   * Never confirms automatically.
   */
  async propose(
    fieldValueId: string,
    opts: {
      value: unknown;
      source: FieldSource;
      confidence?: number;
      ambiguous?: boolean;
      actor: Actor;
      sourceRef?: string;
    },
  ) {
    const fv = await this.getOrThrow(fieldValueId);
    const value = validateFieldValue(fv.product.categoryKey, fv.fieldKey, opts.value);
    const needsReview = computeNeedsReview({
      confidence: opts.confidence,
      ambiguous: opts.ambiguous,
    });
    return this.transition(fv, {
      toStatus: FieldStatus.RECEIVED_PENDING,
      newValue: value,
      data: {
        value: value as Prisma.InputJsonValue,
        source: opts.source,
        confidence: opts.confidence ?? null,
        needsReview,
      },
      actor: opts.actor,
      sourceRef: opts.sourceRef,
      note: needsReview ? "Nizka gotovost — potrebuje ročni pregled." : undefined,
    });
  }

  /**
   * RECEIVED_PENDING → CONFIRMED. If `value` is supplied it's a "popravi"
   * correction applied at confirmation time.
   */
  async confirm(
    fieldValueId: string,
    opts: { actor: Actor; value?: unknown; note?: string },
  ) {
    const fv = await this.getOrThrow(fieldValueId);
    this.assertFrom(fv.status, [FieldStatus.RECEIVED_PENDING], "confirm");
    const corrected =
      opts.value !== undefined
        ? validateFieldValue(fv.product.categoryKey, fv.fieldKey, opts.value)
        : undefined;
    return this.transition(fv, {
      toStatus: FieldStatus.CONFIRMED,
      newValue: corrected ?? (fv.value as unknown),
      data: {
        ...(corrected !== undefined
          ? { value: corrected as Prisma.InputJsonValue, source: FieldSource.MANUAL }
          : {}),
        needsReview: false,
        confidence: null,
        currentRequestId: null,
      },
      actor: opts.actor,
      note: opts.note ?? (corrected !== undefined ? "Popravljeno in potrjeno." : undefined),
    });
  }

  /** RECEIVED_PENDING → REQUESTED (if a request drives it) or MISSING. Clears value. */
  async reject(fieldValueId: string, opts: { actor: Actor; note?: string }) {
    const fv = await this.getOrThrow(fieldValueId);
    this.assertFrom(fv.status, [FieldStatus.RECEIVED_PENDING], "reject");
    const back = fv.currentRequestId ? FieldStatus.REQUESTED : FieldStatus.MISSING;
    return this.transition(fv, {
      toStatus: back,
      newValue: null,
      data: {
        value: Prisma.DbNull,
        source: null,
        confidence: null,
        needsReview: false,
      },
      actor: opts.actor,
      note: opts.note ?? "Zavrnjeno.",
    });
  }

  /** Authoritative manual entry by an org user → CONFIRMED from any state. */
  async manualSet(fieldValueId: string, opts: { value: unknown; actor: Actor }) {
    const fv = await this.getOrThrow(fieldValueId);
    const value = validateFieldValue(fv.product.categoryKey, fv.fieldKey, opts.value);
    return this.transition(fv, {
      toStatus: FieldStatus.CONFIRMED,
      newValue: value,
      data: {
        value: value as Prisma.InputJsonValue,
        source: FieldSource.MANUAL,
        confidence: null,
        needsReview: false,
        currentRequestId: null,
      },
      actor: opts.actor,
      note: "Ročni vnos.",
    });
  }

  /** Any state → MISSING. Clears the value (e.g. data withdrawn / superseded). */
  async clear(fieldValueId: string, opts: { actor: Actor; note?: string }) {
    const fv = await this.getOrThrow(fieldValueId);
    return this.transition(fv, {
      toStatus: FieldStatus.MISSING,
      newValue: null,
      data: {
        value: Prisma.DbNull,
        source: null,
        confidence: null,
        needsReview: false,
        currentRequestId: null,
      },
      actor: opts.actor,
      note: opts.note,
    });
  }

  // -------------------------------------------------------------- internals

  private async getOrThrow(id: string) {
    const fv = await this.prisma.fieldValue.findUnique({
      where: { id },
      include: { product: { select: { categoryKey: true, orgId: true } } },
    });
    if (!fv) throw new NotFoundException(`FieldValue ${id} not found`);
    return fv;
  }

  private assertFrom(current: FieldStatus, allowed: FieldStatus[], action: string) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        `Cannot ${action} a field in status ${current}; expected one of ${allowed.join(", ")}`,
      );
    }
  }

  /** Apply the status change + persist an audit event, atomically. */
  private async transition(
    fv: { id: string; status: FieldStatus; value: Prisma.JsonValue | null },
    opts: {
      toStatus: FieldStatus;
      newValue?: unknown;
      data?: Prisma.FieldValueUpdateInput;
      actor: Actor;
      note?: string;
      sourceRef?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fieldValue.update({
        where: { id: fv.id },
        data: { status: opts.toStatus, ...(opts.data ?? {}) },
      });
      await tx.fieldEvent.create({
        data: {
          fieldValueId: fv.id,
          actorType: opts.actor.type,
          actorId: opts.actor.id,
          fromStatus: fv.status,
          toStatus: opts.toStatus,
          oldValue: fv.value ?? Prisma.DbNull,
          newValue:
            opts.newValue === undefined
              ? Prisma.DbNull
              : opts.newValue === null
                ? Prisma.DbNull
                : (opts.newValue as Prisma.InputJsonValue),
          note: opts.note,
          sourceRef: opts.sourceRef,
        },
      });
      return updated;
    });
  }
}

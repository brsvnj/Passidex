import { Injectable } from "@nestjs/common";
import { FieldStatus, Prisma } from "@prisma/client";
import {
  CATEGORIES,
  fieldsOf,
  requiredFields,
  SCHEMA_VERSION,
} from "@passidex/schema";
import { PrismaService } from "../prisma/prisma.service";

export interface Completeness {
  requiredTotal: number;
  requiredConfirmed: number;
  /** 0..100, share of required fields confirmed. */
  score: number;
  byStatus: Record<FieldStatus, number>;
  pending: number;
  needsReview: number;
}

@Injectable()
export class ProductSchemaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Expose the category catalogue (for the frontend). */
  categories() {
    return CATEGORIES;
  }

  /**
   * Ensure a FieldValue row (status MISSING) exists for every field defined in
   * the product's category. Idempotent — safe to re-run after schema changes.
   */
  async ensureFieldValues(
    productId: string,
    categoryKey: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const defs = fieldsOf(categoryKey);
    if (defs.length === 0) return;
    await tx.fieldValue.createMany({
      data: defs.map((d) => ({
        productId,
        fieldKey: d.key,
        status: FieldStatus.MISSING,
      })),
      skipDuplicates: true,
    });
  }

  /** Compute completeness for one product from its stored field values. */
  async completeness(productId: string, categoryKey: string): Promise<Completeness> {
    const values = await this.prisma.fieldValue.findMany({ where: { productId } });
    const required = new Set(requiredFields(categoryKey).map((f) => f.key));

    const byStatus: Record<FieldStatus, number> = {
      MISSING: 0,
      REQUESTED: 0,
      RECEIVED_PENDING: 0,
      CONFIRMED: 0,
    };
    let requiredConfirmed = 0;
    let needsReview = 0;
    for (const v of values) {
      byStatus[v.status] += 1;
      if (v.needsReview) needsReview += 1;
      if (required.has(v.fieldKey) && v.status === FieldStatus.CONFIRMED) {
        requiredConfirmed += 1;
      }
    }

    const requiredTotal = required.size;
    return {
      requiredTotal,
      requiredConfirmed,
      score:
        requiredTotal === 0
          ? 100
          : Math.round((requiredConfirmed / requiredTotal) * 100),
      byStatus,
      pending: byStatus.RECEIVED_PENDING,
      needsReview,
    };
  }

  get schemaVersion(): string {
    return SCHEMA_VERSION;
  }
}

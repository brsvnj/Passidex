import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { DataRequestStatus, FieldStatus } from "@prisma/client";
import { OrgId } from "../common/context.decorators";
import { PrismaService } from "../prisma/prisma.service";
import { ProductSchemaService } from "../schema/product-schema.service";
import { SchemaModule } from "../schema/schema.module";

@Injectable()
class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schema: ProductSchemaService,
  ) {}

  /**
   * Org-level compliance overview: how many products are complete, how many are
   * waiting, and where the bottlenecks are. Phase 4 expands this with supplier
   * response-time analytics once requests exist.
   */
  async summary(orgId: string) {
    const products = await this.prisma.product.findMany({
      where: { orgId },
      select: { id: true, name: true, categoryKey: true },
    });

    let complete = 0;
    let partial = 0;
    let empty = 0;
    let pendingReview = 0;
    const bottlenecks: { productId: string; name: string; score: number }[] = [];

    for (const p of products) {
      const c = await this.schema.completeness(p.id, p.categoryKey);
      if (c.score >= 100) complete += 1;
      else if (c.requiredConfirmed > 0) partial += 1;
      else empty += 1;
      pendingReview += c.pending;
      if (c.score < 100) {
        bottlenecks.push({ productId: p.id, name: p.name, score: c.score });
      }
    }

    bottlenecks.sort((a, b) => a.score - b.score);

    const awaitingConfirmation = await this.prisma.fieldValue.count({
      where: { status: FieldStatus.RECEIVED_PENDING, product: { orgId } },
    });

    return {
      productsTotal: products.length,
      complete,
      partial,
      empty,
      pendingReview,
      awaitingConfirmation,
      topBottlenecks: bottlenecks.slice(0, 5),
    };
  }

  /**
   * Supply-chain analytics: where compliance is stuck. Surfaces supplier
   * response times, overdue requests, and the oldest open asks — the levers an
   * SME uses to unblock DPP completion.
   */
  async analytics(orgId: string) {
    const now = Date.now();

    // Field status distribution across the org.
    const fieldGroups = await this.prisma.fieldValue.groupBy({
      by: ["status"],
      where: { product: { orgId } },
      _count: { _all: true },
    });
    const fieldStatus: Record<FieldStatus, number> = {
      MISSING: 0,
      REQUESTED: 0,
      RECEIVED_PENDING: 0,
      CONFIRMED: 0,
    };
    for (const g of fieldGroups) fieldStatus[g.status] = g._count._all;

    // Requests with their supplier, timing, and first reply.
    const requests = await this.prisma.dataRequest.findMany({
      where: { orgId },
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } },
        messages: {
          orderBy: { receivedAt: "asc" },
          take: 1,
          select: { receivedAt: true },
        },
      },
    });

    const OPEN: DataRequestStatus[] = [
      DataRequestStatus.SENT,
      DataRequestStatus.REMINDED,
    ];
    const requestStatus: Record<DataRequestStatus, number> = {
      DRAFT: 0,
      SENT: 0,
      REMINDED: 0,
      ANSWERED: 0,
      CLOSED: 0,
    };
    let overdue = 0;

    const perSupplier = new Map<
      string,
      {
        supplierId: string;
        name: string;
        hasEmail: boolean;
        open: number;
        overdue: number;
        answered: number;
        responseHours: number[];
      }
    >();
    const openRequests: {
      requestId: string;
      productName: string;
      supplierName: string;
      status: DataRequestStatus;
      ageDays: number;
      overdue: boolean;
    }[] = [];

    for (const r of requests) {
      requestStatus[r.status] += 1;
      const s = perSupplier.get(r.supplierId) ?? {
        supplierId: r.supplierId,
        name: r.supplier.name,
        hasEmail: !!r.supplier.email,
        open: 0,
        overdue: 0,
        answered: 0,
        responseHours: [],
      };

      const isOverdue =
        OPEN.includes(r.status) && !!r.dueAt && r.dueAt.getTime() < now;
      if (OPEN.includes(r.status)) {
        s.open += 1;
        const ageDays = r.sentAt
          ? (now - r.sentAt.getTime()) / (1000 * 60 * 60 * 24)
          : 0;
        openRequests.push({
          requestId: r.id,
          productName: r.product.name,
          supplierName: r.supplier.name,
          status: r.status,
          ageDays: Math.round(ageDays * 10) / 10,
          overdue: isOverdue,
        });
      }
      if (isOverdue) {
        overdue += 1;
        s.overdue += 1;
      }
      if (
        (r.status === DataRequestStatus.ANSWERED ||
          r.status === DataRequestStatus.CLOSED) &&
        r.messages[0] &&
        r.sentAt
      ) {
        s.answered += 1;
        s.responseHours.push(
          (r.messages[0].receivedAt.getTime() - r.sentAt.getTime()) /
            (1000 * 60 * 60),
        );
      }
      perSupplier.set(r.supplierId, s);
    }

    const suppliers = [...perSupplier.values()]
      .map((s) => ({
        supplierId: s.supplierId,
        name: s.name,
        hasEmail: s.hasEmail,
        open: s.open,
        overdue: s.overdue,
        answered: s.answered,
        avgResponseHours:
          s.responseHours.length > 0
            ? Math.round(
                (s.responseHours.reduce((a, b) => a + b, 0) /
                  s.responseHours.length) *
                  10,
              ) / 10
            : null,
      }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open);

    openRequests.sort((a, b) => b.ageDays - a.ageDays);

    return {
      fieldStatus,
      requestStatus,
      overdue,
      suppliers,
      oldestOpenRequests: openRequests.slice(0, 8),
    };
  }
}

@Controller("dashboard")
class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary(@OrgId() orgId: string) {
    return this.dashboard.summary(orgId);
  }

  @Get("analytics")
  analytics(@OrgId() orgId: string) {
    return this.dashboard.analytics(orgId);
  }
}

@Module({
  imports: [SchemaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

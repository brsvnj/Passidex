import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { FieldStatus } from "@prisma/client";
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
}

@Controller("dashboard")
class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary(@OrgId() orgId: string) {
    return this.dashboard.summary(orgId);
  }
}

@Module({
  imports: [SchemaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

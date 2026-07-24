import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { SchemaModule } from "./schema/schema.module";
import { ProductsModule } from "./products/products.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { FieldValuesModule } from "./field-values/field-values.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmailModule } from "./email/email.module";
import { DataRequestsModule } from "./data-requests/data-requests.module";
import { QueueModule } from "./queue/queue.module";
import { InboundModule } from "./inbound/inbound.module";
import { ExportModule } from "./export/export.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SchemaModule,
    SuppliersModule,
    ProductsModule,
    FieldValuesModule,
    EmailModule,
    DataRequestsModule,
    QueueModule,
    InboundModule,
    ExportModule,
    DashboardModule,
  ],
  providers: [
    // Authentication is required by default; opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { SchemaModule } from "./schema/schema.module";
import { ProductsModule } from "./products/products.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { FieldValuesModule } from "./field-values/field-values.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmailModule } from "./email/email.module";
import { DataRequestsModule } from "./data-requests/data-requests.module";
import { QueueModule } from "./queue/queue.module";
import { InboundModule } from "./inbound/inbound.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SchemaModule,
    OrganizationsModule,
    SuppliersModule,
    ProductsModule,
    FieldValuesModule,
    EmailModule,
    DataRequestsModule,
    QueueModule,
    InboundModule,
    DashboardModule,
  ],
})
export class AppModule {}

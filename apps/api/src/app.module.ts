import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { SchemaModule } from "./schema/schema.module";
import { ProductsModule } from "./products/products.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { FieldValuesModule } from "./field-values/field-values.module";
import { DashboardModule } from "./dashboard/dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SchemaModule,
    OrganizationsModule,
    SuppliersModule,
    ProductsModule,
    FieldValuesModule,
    DashboardModule,
  ],
})
export class AppModule {}

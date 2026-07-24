import { Module } from "@nestjs/common";
import { ProductSchemaService } from "./product-schema.service";
import { SchemaController } from "./schema.controller";

@Module({
  controllers: [SchemaController],
  providers: [ProductSchemaService],
  exports: [ProductSchemaService],
})
export class SchemaModule {}

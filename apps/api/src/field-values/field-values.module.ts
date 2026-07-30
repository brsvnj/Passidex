import { Module } from "@nestjs/common";
import { FieldValueService } from "./field-value.service";
import { FieldValuesController } from "./field-values.controller";

@Module({
  controllers: [FieldValuesController],
  providers: [FieldValueService],
  exports: [FieldValueService],
})
export class FieldValuesModule {}

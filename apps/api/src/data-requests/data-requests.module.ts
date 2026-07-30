import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { FieldValuesModule } from "../field-values/field-values.module";
import { DataRequestService } from "./data-request.service";
import { DataRequestsController } from "./data-requests.controller";

@Module({
  imports: [EmailModule, FieldValuesModule],
  controllers: [DataRequestsController],
  providers: [DataRequestService],
  exports: [DataRequestService],
})
export class DataRequestsModule {}

import { Controller, Get, Module, Param } from "@nestjs/common";
import { OrgId } from "../common/context.decorators";
import { PassportExportService } from "./passport-export.service";

@Controller("products")
class ExportController {
  constructor(private readonly exporter: PassportExportService) {}

  /** The product's DPP document (GS1 Digital Link + attributes by dppPath). */
  @Get(":id/passport")
  passport(@OrgId() orgId: string, @Param("id") id: string) {
    return this.exporter.export(orgId, id);
  }
}

@Module({
  controllers: [ExportController],
  providers: [PassportExportService],
})
export class ExportModule {}

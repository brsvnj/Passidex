import { Controller, Get, Header, Module, Param } from "@nestjs/common";
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

  /** QR code (SVG) encoding the product's GS1 Digital Link. */
  @Get(":id/qr")
  @Header("Content-Type", "image/svg+xml")
  qr(@OrgId() orgId: string, @Param("id") id: string) {
    return this.exporter.qrSvg(orgId, id);
  }
}

@Module({
  controllers: [ExportController],
  providers: [PassportExportService],
})
export class ExportModule {}

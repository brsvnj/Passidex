import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { OrgId } from "../common/context.decorators";
import { DataRequestService } from "./data-request.service";
import { CreateDataRequestDto } from "./dto";

@Controller("data-requests")
export class DataRequestsController {
  constructor(private readonly requests: DataRequestService) {}

  @Get()
  list(@OrgId() orgId: string, @Query("productId") productId?: string) {
    return this.requests.listForOrg(orgId, productId);
  }

  /** Manual reminder sweep (also runs on schedule via pg-boss). */
  @Post("run-reminders")
  runReminders() {
    return this.requests.runReminders();
  }

  @Get(":id")
  getOne(@OrgId() orgId: string, @Param("id") id: string) {
    return this.requests.getOne(orgId, id);
  }

  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateDataRequestDto) {
    return this.requests.create(orgId, dto);
  }

  @Post(":id/cancel")
  cancel(@OrgId() orgId: string, @Param("id") id: string) {
    return this.requests.cancel(orgId, id);
  }
}

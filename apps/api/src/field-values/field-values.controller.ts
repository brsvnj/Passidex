import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentActor, OrgId } from "../common/context.decorators";
import type { Actor } from "./field-value.service";
import { FieldValueService } from "./field-value.service";
import { ConfirmFieldDto, ManualSetFieldDto, RejectFieldDto } from "./dto";

@Controller()
export class FieldValuesController {
  constructor(private readonly fields: FieldValueService) {}

  /** Review queue: all fields waiting for a human decision, in the org. */
  @Get("field-values/pending")
  pending(@OrgId() orgId: string) {
    return this.fields.pendingForOrg(orgId);
  }

  @Get("field-values/:id/history")
  history(@OrgId() orgId: string, @Param("id") id: string) {
    return this.fields.history(orgId, id);
  }

  @Post("field-values/:id/confirm")
  confirm(
    @Param("id") id: string,
    @Body() dto: ConfirmFieldDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.fields.confirm(id, { actor, value: dto.value, note: dto.note });
  }

  @Post("field-values/:id/reject")
  reject(
    @Param("id") id: string,
    @Body() dto: RejectFieldDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.fields.reject(id, { actor, note: dto.note });
  }

  /** Manual entry by an org user — authoritative, goes straight to CONFIRMED. */
  @Post("field-values/:id/manual")
  manual(
    @Param("id") id: string,
    @Body() dto: ManualSetFieldDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.fields.manualSet(id, { value: dto.value, actor });
  }

  @Post("field-values/:id/clear")
  clear(@Param("id") id: string, @CurrentActor() actor: Actor) {
    return this.fields.clear(id, { actor });
  }
}

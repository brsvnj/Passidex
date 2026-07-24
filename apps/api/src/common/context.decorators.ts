import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import { ActorType } from "@prisma/client";
import type { Actor } from "../field-values/field-value.service";

/**
 * Minimal multi-tenant context for Phase 1. Real auth (sessions / JWT) replaces
 * these headers later, but the model already carries `orgId` everywhere so the
 * swap is isolated to this file.
 *
 *   X-Org-Id:  required — the tenant
 *   X-User-Id: optional — the acting user (recorded in the audit log)
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const orgId = req.headers["x-org-id"];
    if (!orgId || typeof orgId !== "string") {
      throw new BadRequestException("Missing X-Org-Id header");
    }
    return orgId;
  },
);

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.headers["x-user-id"];
    return {
      type: ActorType.USER,
      id: typeof userId === "string" ? userId : undefined,
    };
  },
);

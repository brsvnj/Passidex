import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ActorType } from "@prisma/client";
import type { Actor } from "../field-values/field-value.service";
import type { AuthContext } from "../auth/jwt-auth.guard";

/**
 * Tenant + actor context, resolved from the authenticated session (set by the
 * global JwtAuthGuard). Controllers keep using @OrgId() / @CurrentActor()
 * unchanged — only the source moved from a header to the verified JWT.
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return (req.auth as AuthContext).orgId;
  },
);

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.auth as AuthContext | undefined;
    return { type: ActorType.USER, id: auth?.userId };
  },
);

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "./jwt-auth.guard";

/** The authenticated session context (userId, orgId, role). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest();
    return req.auth as AuthContext;
  },
);

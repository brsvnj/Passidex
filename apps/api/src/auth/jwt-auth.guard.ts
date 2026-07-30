import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

export const SESSION_COOKIE = "passidex_session";

/** Request context attached by the guard once a session is validated. */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException("Not authenticated");

    try {
      const payload = this.auth.verifyToken(token);
      (req as Request & { auth: AuthContext }).auth = {
        userId: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }

  private extractToken(req: Request): string | undefined {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE
    ];
    if (cookieToken) return cookieToken;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice(7);
    return undefined;
  }
}

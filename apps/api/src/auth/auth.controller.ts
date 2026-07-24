import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthService, type PublicUser } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { AuthContext } from "./jwt-auth.guard";
import { SESSION_COOKIE } from "./jwt-auth.guard";
import { Public } from "./public.decorator";
import { LoginDto, RegisterDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto);
    this.setCookie(res, user);
    return user;
  }

  @Public()
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(dto.email, dto.password);
    this.setCookie(res, user);
    return user;
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() ctx: AuthContext) {
    return this.auth.me(ctx.userId);
  }

  private setCookie(res: Response, user: PublicUser): void {
    res.cookie(SESSION_COOKIE, this.auth.signToken(user), {
      ...this.cookieOptions(),
      maxAge: this.maxAgeMs(),
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.config.get("COOKIE_SECURE") === "true",
      path: "/",
    };
  }

  /** Parse JWT_EXPIRES like "7d" / "24h" into milliseconds (default 7 days). */
  private maxAgeMs(): number {
    const raw = this.config.get<string>("JWT_EXPIRES") || "7d";
    const m = raw.match(/^(\d+)([dhm])$/);
    if (!m) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(m[1]);
    const unit = { d: 86400, h: 3600, m: 60 }[m[2]] ?? 86400;
    return n * unit * 1000;
  }
}

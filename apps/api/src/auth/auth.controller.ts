import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthService, type PublicUser } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { AuthContext } from "./jwt-auth.guard";
import { Public } from "./public.decorator";
import { clearSessionCookie, setSessionCookie } from "./session-cookie";
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
    clearSessionCookie(res, this.config);
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() ctx: AuthContext) {
    return this.auth.me(ctx.userId);
  }

  private setCookie(res: Response, user: PublicUser): void {
    setSessionCookie(res, this.auth.signToken(user), this.config);
  }
}

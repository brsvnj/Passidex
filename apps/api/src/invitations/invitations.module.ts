import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { OrgId } from "../common/context.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/jwt-auth.guard";
import { Public } from "../auth/public.decorator";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { setSessionCookie } from "../auth/session-cookie";
import { EmailModule } from "../email/email.module";
import { InvitationsService } from "./invitations.service";

class InviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(["member", "admin"])
  role?: string;
}

class AcceptInviteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

/** Authenticated team management (owners/admins invite; anyone lists members). */
@Controller("team")
class TeamController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  members(@OrgId() orgId: string) {
    return this.invitations.listMembers(orgId);
  }

  @Get("invitations")
  list(@OrgId() orgId: string) {
    return this.invitations.listInvitations(orgId);
  }

  @Post("invitations")
  invite(
    @OrgId() orgId: string,
    @CurrentUser() ctx: AuthContext,
    @Body() dto: InviteDto,
  ) {
    return this.invitations.invite(
      orgId,
      { userId: ctx.userId, role: ctx.role },
      dto,
    );
  }

  @Post("invitations/:id/revoke")
  revoke(
    @OrgId() orgId: string,
    @CurrentUser() ctx: AuthContext,
    @Param("id") id: string,
  ) {
    return this.invitations.revoke(orgId, ctx.role, id);
  }
}

/** Public invitation acceptance (no session yet). */
@Controller("invitations")
@Throttle({ default: { limit: 20, ttl: 60_000 } })
class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get(":token")
  describe(@Param("token") token: string) {
    return this.invitations.describe(token);
  }

  @Public()
  @Post(":token/accept")
  async accept(
    @Param("token") token: string,
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.invitations.accept(token, dto);
    setSessionCookie(res, this.auth.signToken(user), this.config);
    return user;
  }
}

@Module({
  imports: [EmailModule, AuthModule],
  controllers: [TeamController, InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}

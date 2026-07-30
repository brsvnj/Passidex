import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { RegisterDto } from "./dto";

const RESET_TTL_MINUTES = 60;

export interface SessionPayload {
  sub: string; // userId
  orgId: string;
  role: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string;
  orgName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  /** Register a new tenant: creates the organization and its first (owner) user. */
  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const org = await this.prisma.organization.create({
      data: {
        name: dto.orgName,
        users: {
          create: { email, name: dto.name, passwordHash, role: "owner" },
        },
      },
      include: { users: true },
    });
    return this.toPublic(org.users[0], org.name);
  }

  /** Verify credentials and return the user, or throw. */
  async login(email: string, password: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { organization: { select: { name: true } } },
    });
    if (!user?.passwordHash) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.toPublic(user, user.organization.name);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { name: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return this.toPublic(user, user.organization.name);
  }

  /**
   * Start a password reset. Always resolves the same way (no account
   * enumeration): if the email exists, a one-time link is emailed.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return;

    const token = randomBytes(24).toString("hex");
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    const appUrl = this.config.get<string>("APP_URL") || "http://localhost:5173";
    const link = `${appUrl}/?reset=${token}`;
    await this.email.send({
      to: user.email,
      subject: "Ponastavitev gesla – Passidex",
      textBody:
        `Pozdravljeni,\n\nPrejeli smo zahtevo za ponastavitev gesla za vaš račun Passidex.\n\n` +
        `Novo geslo nastavite tukaj:\n${link}\n\n` +
        `Povezava velja ${RESET_TTL_MINUTES} minut. Če zahteve niste poslali vi, ` +
        `to sporočilo prezrite.\n\nEkipa Passidex`,
    });
  }

  /** Complete a reset: set the new password and consume the token. */
  async resetPassword(token: string, newPassword: string): Promise<PublicUser> {
    const reset = await this.prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Reset link is invalid or has expired");
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
        include: { organization: { select: { name: true } } },
      });
      await tx.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });
      // Invalidate any other outstanding reset tokens for this user.
      await tx.passwordReset.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return updated;
    });
    return this.toPublic(user, user.organization.name);
  }

  /** Change password for a logged-in user (verifies the current one). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException("Current password is incorrect");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  signToken(user: PublicUser): string {
    const payload: SessionPayload = {
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
    };
    return this.jwt.sign(payload);
  }

  verifyToken(token: string): SessionPayload {
    return this.jwt.verify<SessionPayload>(token);
  }

  private toPublic(
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      orgId: string;
    },
    orgName: string,
  ): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      orgName,
    };
  }
}

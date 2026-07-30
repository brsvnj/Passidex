import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { InvitationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import type { PublicUser } from "../auth/auth.service";

const INVITE_TTL_DAYS = 14;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private get appUrl(): string {
    return this.config.get<string>("APP_URL") || "http://localhost:5173";
  }

  /** Only owners/admins manage the team. */
  private assertManager(role: string): void {
    if (role !== "owner" && role !== "admin") {
      throw new ForbiddenException("Only an owner can manage the team");
    }
  }

  async listMembers(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  listInvitations(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { orgId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: "desc" },
    });
  }

  async invite(
    orgId: string,
    actor: { userId: string; role: string },
    dto: { email: string; role?: string },
  ) {
    this.assertManager(actor.role);
    const email = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException("A user with this email already exists");
    }
    const openInvite = await this.prisma.invitation.findFirst({
      where: { orgId, email, status: InvitationStatus.PENDING },
    });
    if (openInvite) {
      throw new ConflictException("An invitation for this email is already pending");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");

    const token = randomBytes(24).toString("hex");
    const invitation = await this.prisma.invitation.create({
      data: {
        orgId,
        email,
        role: dto.role === "admin" ? "admin" : "member",
        token,
        invitedByUserId: actor.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const link = `${this.appUrl}/?invite=${token}`;
    await this.email.send({
      to: email,
      subject: `Povabilo v ekipo ${org.name} na Passidex`,
      textBody:
        `Pozdravljeni,\n\nVabljeni ste v ekipo "${org.name}" na platformi Passidex ` +
        `za skladnost z digitalnimi potnimi listi izdelkov (DPP).\n\n` +
        `Sprejmite povabilo in ustvarite svoj račun tukaj:\n${link}\n\n` +
        `Povezava velja ${INVITE_TTL_DAYS} dni.\n\nEkipa Passidex`,
    });

    return invitation;
  }

  async revoke(orgId: string, actorRole: string, id: string) {
    this.assertManager(actorRole);
    const invite = await this.prisma.invitation.findFirst({ where: { id, orgId } });
    if (!invite) throw new NotFoundException("Invitation not found");
    await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
    return { ok: true };
  }

  /** Public: describe an invitation by token for the accept screen. */
  async describe(token: string) {
    const invite = await this.loadValid(token);
    const org = await this.prisma.organization.findUnique({
      where: { id: invite.orgId },
      select: { name: true },
    });
    return { email: invite.email, orgName: org?.name ?? "", role: invite.role };
  }

  /** Public: accept an invitation, creating the user in the org. */
  async accept(
    token: string,
    dto: { name?: string; password: string },
  ): Promise<PublicUser> {
    const invite = await this.loadValid(token);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { user, orgName } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          orgId: invite.orgId,
          email: invite.email,
          name: dto.name,
          role: invite.role,
          passwordHash,
        },
        include: { organization: { select: { name: true } } },
      });
      await tx.invitation.update({
        where: { id: invite.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });
      return { user: created, orgName: created.organization.name };
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      orgName,
    };
  }

  private async loadValid(token: string) {
    const invite = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invite || invite.status !== InvitationStatus.PENDING) {
      throw new NotFoundException("Invitation not found or already used");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invitation has expired");
    }
    return invite;
  }
}

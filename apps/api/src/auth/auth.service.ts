import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto";

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

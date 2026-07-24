import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
} from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

@Injectable()
class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
  }

  create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: { name: dto.name } });
  }
}

/**
 * Bootstrapping endpoint for tenants. In Phase 1 orgs are created directly;
 * once auth lands, org creation is tied to sign-up.
 */
@Controller("organizations")
class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  list() {
    return this.orgs.list();
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgs.create(dto);
  }
}

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}

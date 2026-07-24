import { Module } from "@nestjs/common";
import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
} from "@nestjs/common";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { OrgId } from "../common/context.decorators";
import { PrismaService } from "../prisma/prisma.service";

class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}

@Injectable()
class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.supplier.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
    });
  }

  create(orgId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        orgId,
        name: dto.name,
        email: dto.email,
        language: dto.language,
      },
    });
  }

  get(orgId: string, id: string) {
    return this.prisma.supplier.findFirst({
      where: { id, orgId },
      include: { components: true },
    });
  }
}

@Controller("suppliers")
class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.suppliers.list(orgId);
  }

  @Get(":id")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.suppliers.get(orgId, id);
  }

  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(orgId, dto);
  }
}

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}

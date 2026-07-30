import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isKnownCategory } from "@passidex/schema";
import { PrismaService } from "../prisma/prisma.service";
import { ProductSchemaService } from "../schema/product-schema.service";
import { CreateComponentDto, CreateProductDto } from "./dto";
import { generatePassportCode } from "./passport-code.util";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schema: ProductSchemaService,
  ) {}

  async create(orgId: string, dto: CreateProductDto) {
    if (!isKnownCategory(dto.categoryKey)) {
      throw new BadRequestException(`Unknown category "${dto.categoryKey}"`);
    }
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          orgId,
          name: dto.name,
          brand: dto.brand,
          categoryKey: dto.categoryKey,
          gtin: dto.gtin,
          schemaVersion: this.schema.schemaVersion,
          passportCode: generatePassportCode(dto.categoryKey),
        },
      });
      await this.schema.ensureFieldValues(product.id, product.categoryKey, tx);
      return product;
    });
  }

  async list(orgId: string, categoryKey?: string) {
    const products = await this.prisma.product.findMany({
      where: { orgId, ...(categoryKey ? { categoryKey } : {}) },
      orderBy: { createdAt: "desc" },
    });
    // Attach a completeness summary per product for dashboard cards.
    return Promise.all(
      products.map(async (p) => ({
        ...p,
        completeness: await this.schema.completeness(p.id, p.categoryKey),
      })),
    );
  }

  /** Full passport: product + components + field values + completeness. */
  async getOne(orgId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, orgId },
      include: {
        components: { include: { supplier: true } },
        fieldValues: { orderBy: { fieldKey: "asc" } },
      },
    });
    if (!product) throw new NotFoundException("Product not found");
    const completeness = await this.schema.completeness(id, product.categoryKey);
    return { ...product, completeness };
  }

  async remove(orgId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, orgId } });
    if (!product) throw new NotFoundException("Product not found");
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  async addComponent(orgId: string, productId: string, dto: CreateComponentDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, orgId },
    });
    if (!product) throw new NotFoundException("Product not found");
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, orgId },
      });
      if (!supplier) throw new BadRequestException("Unknown supplier");
    }
    return this.prisma.component.create({
      data: {
        productId,
        name: dto.name,
        note: dto.note,
        supplierId: dto.supplierId,
      },
    });
  }
}

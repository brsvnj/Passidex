import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FieldStatus } from "@prisma/client";
import * as QRCode from "qrcode";
import {
  getCategory,
  getFieldDefinition,
  requiredFields,
} from "@passidex/schema";
import { PrismaService } from "../prisma/prisma.service";
import { setByPath } from "./set-by-path";

/**
 * Projects a product's CONFIRMED field values into a DPP document keyed by each
 * field's `dppPath`, plus a GS1 Digital Link. This is a pure projection over the
 * stored data — when the EU DPP Registry finalises its API/schema, only the
 * output serialization changes, not the model.
 */
@Injectable()
export class PassportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get resolverDomain(): string {
    return this.config.get<string>("GS1_RESOLVER_DOMAIN") || "id.passidex.eu";
  }

  /** GS1 Digital Link: GTIN-based when available, else a Passidex resolver URI. */
  private digitalLink(gtin: string | null, passportCode: string): string {
    const host = `https://${this.resolverDomain}`;
    return gtin ? `${host}/01/${gtin}` : `${host}/dpp/${encodeURIComponent(passportCode)}`;
  }

  /** An SVG QR code encoding the product's GS1 Digital Link, for print/labels. */
  async qrSvg(orgId: string, productId: string): Promise<string> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, orgId },
      select: { gtin: true, passportCode: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    const link = this.digitalLink(product.gtin, product.passportCode);
    return QRCode.toString(link, { type: "svg", margin: 1, width: 120 });
  }

  async export(orgId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, orgId },
      include: {
        organization: { select: { name: true } },
        fieldValues: true,
      },
    });
    if (!product) throw new NotFoundException("Product not found");

    const category = getCategory(product.categoryKey);
    const data: Record<string, unknown> = {};
    const attributes: {
      path: string;
      fieldKey: string;
      label: string;
      value: unknown;
      unit?: string;
      source: string | null;
      confirmedAt: string;
    }[] = [];

    for (const fv of product.fieldValues) {
      if (fv.status !== FieldStatus.CONFIRMED) continue;
      const def = getFieldDefinition(product.categoryKey, fv.fieldKey);
      if (!def) continue;
      setByPath(data, def.dppPath, fv.value);
      attributes.push({
        path: def.dppPath,
        fieldKey: fv.fieldKey,
        label: def.label,
        value: fv.value,
        unit: def.unit,
        source: fv.source,
        confirmedAt: fv.updatedAt.toISOString(),
      });
    }

    const required = requiredFields(product.categoryKey).map((f) => f.key);
    const confirmedKeys = new Set(
      product.fieldValues
        .filter((fv) => fv.status === FieldStatus.CONFIRMED)
        .map((fv) => fv.fieldKey),
    );
    const missingRequired = required.filter((k) => !confirmedKeys.has(k));

    return {
      "@context": `https://${this.resolverDomain}/dpp/context/v1`,
      schemaVersion: product.schemaVersion,
      gs1DigitalLink: this.digitalLink(product.gtin, product.passportCode),
      identification: {
        passportCode: product.passportCode,
        gtin: product.gtin,
        name: product.name,
        manufacturer: product.brand,
        category: product.categoryKey,
        categoryLabel: category?.label,
        framework: category?.framework,
        frameworkLabel: category?.frameworkLabel,
        issuer: product.organization.name,
      },
      data,
      attributes,
      compliance: {
        requiredTotal: required.length,
        requiredConfirmed: required.length - missingRequired.length,
        complete: missingRequired.length === 0,
        missingRequired,
      },
    };
  }
}

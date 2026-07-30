import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ActorType,
  DataRequestStatus,
  FieldStatus,
  Prisma,
} from "@prisma/client";
import { fieldsOf, getFieldDefinition } from "@passidex/schema";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { FieldValueService } from "../field-values/field-value.service";
import { renderRequestEmail } from "../email/templates";
import { CreateDataRequestDto } from "./dto";

@Injectable()
export class DataRequestService {
  private readonly logger = new Logger(DataRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly fields: FieldValueService,
  ) {}

  private get reminderAfterDays(): number {
    return Number(this.config.get("REMINDER_AFTER_DAYS") ?? 7);
  }
  private get maxReminders(): number {
    return Number(this.config.get("MAX_REMINDERS") ?? 2);
  }
  private get inboundDomain(): string {
    return this.config.get<string>("INBOUND_EMAIL_DOMAIN") || "inbound.passidex.eu";
  }

  private addDays(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // ---------------------------------------------------------------- create

  async create(orgId: string, dto: CreateDataRequestDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, orgId },
      include: { organization: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, orgId },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");

    // Which fields to request: explicit list, or every supplier-provided field
    // still MISSING for this product.
    const fieldValues = await this.prisma.fieldValue.findMany({
      where: { productId: product.id, status: FieldStatus.MISSING },
    });

    const wanted = new Set(
      dto.fieldKeys ??
        fieldsOf(product.categoryKey)
          .filter((f) => f.suppliedBy === "supplier")
          .map((f) => f.key),
    );
    const targets = fieldValues.filter((fv) => wanted.has(fv.fieldKey));

    if (targets.length === 0) {
      throw new BadRequestException(
        "No MISSING supplier fields to request for this product.",
      );
    }

    const language = dto.language ?? supplier.language ?? "sl";
    const dueAt = this.addDays(this.reminderAfterDays);

    // Persist the request + its field links, transition fields to REQUESTED,
    // all atomically.
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dataRequest.create({
        data: {
          orgId,
          productId: product.id,
          supplierId: supplier.id,
          componentId: dto.componentId,
          language,
          status: DataRequestStatus.DRAFT,
          dueAt,
          fields: {
            create: targets.map((t) => ({ fieldKey: t.fieldKey })),
          },
        },
      });
      const replyTo = `req-${created.id}@${this.inboundDomain}`;
      await tx.dataRequest.update({
        where: { id: created.id },
        data: { replyToAddress: replyTo },
      });
      for (const fv of targets) {
        await tx.fieldValue.update({
          where: { id: fv.id },
          data: { status: FieldStatus.REQUESTED, currentRequestId: created.id },
        });
        await tx.fieldEvent.create({
          data: {
            fieldValueId: fv.id,
            actorType: ActorType.SYSTEM,
            fromStatus: fv.status,
            toStatus: FieldStatus.REQUESTED,
            sourceRef: created.id,
            note: "Zahteva dobavitelju poslana.",
          },
        });
      }
      return tx.dataRequest.findUniqueOrThrow({
        where: { id: created.id },
        include: { fields: true },
      });
    });

    // Send the email after commit. No supplier email → stays DRAFT for manual entry.
    if (supplier.email) {
      await this.deliver(request.id, {
        isReminder: false,
        supplierEmail: supplier.email,
        supplierName: supplier.name,
        language,
        orgName: product.organization.name,
        productName: product.name,
        replyTo: request.replyToAddress ?? undefined,
        dueAt,
        fieldKeys: request.fields.map((f) => f.fieldKey),
        categoryKey: product.categoryKey,
      });
      return this.getOne(orgId, request.id);
    }

    this.logger.log(
      `Request ${request.id} created without email (supplier has no address) — awaiting manual entry.`,
    );
    return this.getOne(orgId, request.id);
  }

  // ---------------------------------------------------------------- reminders

  /**
   * Resend requests that are past due and unanswered, up to MAX_REMINDERS.
   * Invoked on a schedule (pg-boss) and via the manual endpoint.
   */
  async runReminders(): Promise<{ processed: number; sent: number }> {
    const now = new Date();
    const due = await this.prisma.dataRequest.findMany({
      where: {
        status: { in: [DataRequestStatus.SENT, DataRequestStatus.REMINDED] },
        dueAt: { lte: now },
        reminderCount: { lt: this.maxReminders },
      },
      include: {
        fields: true,
        supplier: true,
        product: { include: { organization: true } },
      },
    });

    let sent = 0;
    for (const r of due) {
      if (!r.supplier.email) continue;
      await this.deliver(r.id, {
        isReminder: true,
        supplierEmail: r.supplier.email,
        supplierName: r.supplier.name,
        language: r.language,
        orgName: r.product.organization.name,
        productName: r.product.name,
        replyTo: r.replyToAddress ?? undefined,
        dueAt: this.addDays(this.reminderAfterDays),
        fieldKeys: r.fields.map((f) => f.fieldKey),
        categoryKey: r.product.categoryKey,
      });
      await this.prisma.dataRequest.update({
        where: { id: r.id },
        data: {
          status: DataRequestStatus.REMINDED,
          reminderCount: { increment: 1 },
          dueAt: this.addDays(this.reminderAfterDays),
        },
      });
      sent += 1;
    }
    this.logger.log(`Reminder sweep: ${due.length} due, ${sent} sent.`);
    return { processed: due.length, sent };
  }

  // ---------------------------------------------------------------- queries

  listForOrg(orgId: string, productId?: string) {
    return this.prisma.dataRequest.findMany({
      where: { orgId, ...(productId ? { productId } : {}) },
      include: { fields: true, supplier: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(orgId: string, id: string) {
    const request = await this.prisma.dataRequest.findFirst({
      where: { id, orgId },
      include: {
        fields: true,
        supplier: true,
        product: { select: { id: true, name: true, categoryKey: true } },
      },
    });
    if (!request) throw new NotFoundException("Data request not found");
    return {
      ...request,
      fieldLabels: request.fields.map((f) => ({
        fieldKey: f.fieldKey,
        label:
          getFieldDefinition(request.product.categoryKey, f.fieldKey)?.label ??
          f.fieldKey,
      })),
    };
  }

  /** Cancel a request and revert its still-open fields to MISSING. */
  async cancel(orgId: string, id: string) {
    const request = await this.prisma.dataRequest.findFirst({
      where: { id, orgId },
      include: { fields: true },
    });
    if (!request) throw new NotFoundException("Data request not found");

    const openFields = await this.prisma.fieldValue.findMany({
      where: {
        productId: request.productId,
        currentRequestId: request.id,
        status: FieldStatus.REQUESTED,
      },
    });
    for (const fv of openFields) {
      await this.fields.clear(fv.id, {
        actor: { type: ActorType.USER },
        note: "Zahteva preklicana.",
      });
    }
    await this.prisma.dataRequest.update({
      where: { id },
      data: { status: DataRequestStatus.CLOSED },
    });
    return { ok: true, revertedFields: openFields.length };
  }

  // ---------------------------------------------------------------- internal

  private async deliver(
    requestId: string,
    ctx: {
      isReminder: boolean;
      supplierEmail: string;
      supplierName: string;
      language: string;
      orgName: string;
      productName: string;
      replyTo?: string;
      dueAt: Date;
      fieldKeys: string[];
      categoryKey: string;
    },
  ): Promise<void> {
    const fields = ctx.fieldKeys.map((key) => {
      const def = getFieldDefinition(ctx.categoryKey, key);
      return {
        label: def?.label ?? key,
        help: def?.help,
        required: def?.required ?? false,
      };
    });

    const rendered = renderRequestEmail({
      language: ctx.language,
      supplierName: ctx.supplierName,
      orgName: ctx.orgName,
      productName: ctx.productName,
      fields,
      replyTo: ctx.replyTo ?? "",
      dueDateISO: ctx.dueAt.toISOString(),
      isReminder: ctx.isReminder,
    });

    await this.email.send({
      to: ctx.supplierEmail,
      subject: rendered.subject,
      textBody: rendered.textBody,
      htmlBody: rendered.htmlBody,
      replyTo: ctx.replyTo,
    });

    // First successful send flips DRAFT → SENT and stamps sentAt.
    await this.prisma.dataRequest.updateMany({
      where: { id: requestId, status: DataRequestStatus.DRAFT },
      data: { status: DataRequestStatus.SENT, sentAt: new Date() },
    });
  }
}

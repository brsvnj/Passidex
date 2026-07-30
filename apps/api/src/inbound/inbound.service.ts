import { Injectable, Logger } from "@nestjs/common";
import { DataRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { QueueService } from "../queue/queue.module";
import { AiExtractionService } from "../ai/ai-extraction.service";
import type { PostmarkInbound } from "./postmark.types";

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly extraction: AiExtractionService,
  ) {}

  /**
   * Handle a Postmark inbound email: match it to its DataRequest via the unique
   * reply-to address, store the message + attachments, mark the request
   * answered, and hand off to AI extraction (queued, or inline in dev).
   */
  async handlePostmark(
    payload: PostmarkInbound,
  ): Promise<{ ok: boolean; messageId?: string }> {
    const candidates = this.recipientCandidates(payload);
    const request = await this.findRequest(candidates);
    if (!request) {
      this.logger.warn(
        `Inbound email did not match any request (recipients: ${candidates.join(", ")}).`,
      );
      return { ok: false };
    }

    const fromEmail = payload.FromFull?.Email ?? payload.From ?? "unknown";
    const body = payload.StrippedTextReply || payload.TextBody || "";

    const message = await this.prisma.inboundMessage.create({
      data: {
        orgId: request.orgId,
        requestId: request.id,
        fromEmail,
        subject: payload.Subject,
        rawBody: body,
      },
    });

    for (const att of payload.Attachments ?? []) {
      const buffer = Buffer.from(att.Content, "base64");
      const storageKey = await this.storage.put(request.orgId, att.Name, buffer);
      await this.prisma.document.create({
        data: {
          orgId: request.orgId,
          messageId: message.id,
          filename: att.Name,
          contentType: att.ContentType,
          storageKey,
          sizeBytes: att.ContentLength ?? buffer.length,
        },
      });
    }

    await this.prisma.dataRequest.update({
      where: { id: request.id },
      data: { status: DataRequestStatus.ANSWERED },
    });

    // Hand off to AI extraction. Queue when available; otherwise run inline.
    const queued = await this.queue.enqueueParse(message.id);
    if (!queued) {
      await this.extraction.process(message.id).catch((e) =>
        this.logger.error(`Inline extraction failed: ${(e as Error).message}`),
      );
    }

    return { ok: true, messageId: message.id };
  }

  private recipientCandidates(payload: PostmarkInbound): string[] {
    const list = [
      payload.OriginalRecipient,
      payload.To,
      ...(payload.ToFull?.map((t) => t.Email) ?? []),
    ];
    return list
      .filter((s): s is string => !!s)
      .flatMap((s) => s.split(","))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  private async findRequest(candidates: string[]) {
    for (const addr of candidates) {
      const byAddress = await this.prisma.dataRequest.findFirst({
        where: { replyToAddress: addr },
      });
      if (byAddress) return byAddress;

      const m = addr.match(/req-([^@]+)@/);
      if (m) {
        const byId = await this.prisma.dataRequest.findUnique({
          where: { id: m[1] },
        });
        if (byId) return byId;
      }
    }
    return null;
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  replyTo?: string;
}

export interface SendResult {
  provider: "postmark" | "console";
  messageId?: string;
}

/**
 * Sends transactional email. Uses Postmark when POSTMARK_SERVER_TOKEN is set;
 * otherwise logs the message to the console so the full request lifecycle is
 * testable without credentials (dev fallback).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string | undefined {
    return this.config.get<string>("POSTMARK_SERVER_TOKEN") || undefined;
  }

  private get from(): string {
    return this.config.get<string>("SENDER_EMAIL") || "noreply@passidex.eu";
  }

  async send(email: OutgoingEmail): Promise<SendResult> {
    if (!this.token) {
      this.logger.log(
        `[email:console] to=${email.to} replyTo=${email.replyTo ?? "-"} subject="${email.subject}"\n${email.textBody}`,
      );
      return { provider: "console" };
    }

    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.token,
      },
      body: JSON.stringify({
        From: this.from,
        To: email.to,
        Subject: email.subject,
        TextBody: email.textBody,
        HtmlBody: email.htmlBody,
        ReplyTo: email.replyTo,
        MessageStream: "outbound",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Postmark send failed (${res.status}): ${body}`);
    }
    const json = (await res.json()) as { MessageID?: string };
    return { provider: "postmark", messageId: json.MessageID };
  }
}

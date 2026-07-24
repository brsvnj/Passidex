import {
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import PgBoss from "pg-boss";
import { DataRequestsModule } from "../data-requests/data-requests.module";
import { DataRequestService } from "../data-requests/data-request.service";
import { AiModule } from "../ai/ai.module";
import { AiExtractionService } from "../ai/ai-extraction.service";

const REMINDER_QUEUE = "reminders.sweep";
const PARSE_QUEUE = "parse.message";

/**
 * Durable background jobs on top of PostgreSQL (pg-boss — no extra Redis):
 *  - reminders.sweep : cron resend of overdue supplier requests (Phase 2)
 *  - parse.message   : AI extraction of a received inbound message (Phase 3)
 *
 * When DATABASE_URL is absent (or DISABLE_SCHEDULER=true) the queue is disabled;
 * `enabled` is false and callers fall back to running work inline.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss?: PgBoss;

  constructor(
    private readonly config: ConfigService,
    private readonly requests: DataRequestService,
    private readonly extraction: AiExtractionService,
  ) {}

  get enabled(): boolean {
    return !!this.boss;
  }

  async onModuleInit(): Promise<void> {
    const connectionString = this.config.get<string>("DATABASE_URL");
    if (!connectionString || this.config.get("DISABLE_SCHEDULER") === "true") {
      this.logger.warn("Queue disabled — jobs will run inline where triggered.");
      return;
    }

    const boss = new PgBoss({ connectionString });
    boss.on("error", (err) => this.logger.error("pg-boss error", err));
    await boss.start();
    await boss.createQueue(REMINDER_QUEUE);
    await boss.createQueue(PARSE_QUEUE);

    await boss.work(REMINDER_QUEUE, async () => {
      await this.requests.runReminders();
    });
    await boss.work(PARSE_QUEUE, async (jobs) => {
      for (const job of jobs) {
        const { messageId } = job.data as { messageId: string };
        await this.extraction.process(messageId);
      }
    });

    const cron = this.config.get<string>("REMINDER_CRON") || "0 * * * *";
    await boss.schedule(REMINDER_QUEUE, cron);

    this.boss = boss;
    this.logger.log(`Queue started (reminder cron "${cron}").`);
  }

  /** Enqueue an AI-parsing job. Returns false if the queue is disabled. */
  async enqueueParse(messageId: string): Promise<boolean> {
    if (!this.boss) return false;
    await this.boss.send(PARSE_QUEUE, { messageId });
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop();
  }
}

@Module({
  imports: [DataRequestsModule, AiModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}

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

const REMINDER_QUEUE = "reminders.sweep";

/**
 * Durable background jobs on top of PostgreSQL (pg-boss — no extra Redis).
 * Phase 2 uses it for the reminder sweep; Phase 3 adds the AI-parsing queue.
 *
 * If DATABASE_URL is absent the scheduler is skipped with a warning so the API
 * still boots; the manual POST /data-requests/run-reminders endpoint remains.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss?: PgBoss;

  constructor(
    private readonly config: ConfigService,
    private readonly requests: DataRequestService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.config.get<string>("DATABASE_URL");
    if (!connectionString) {
      this.logger.warn("DATABASE_URL not set — reminder scheduler disabled.");
      return;
    }
    if (this.config.get("DISABLE_SCHEDULER") === "true") {
      this.logger.warn("DISABLE_SCHEDULER=true — reminder scheduler disabled.");
      return;
    }

    const boss = new PgBoss({ connectionString });
    boss.on("error", (err) => this.logger.error("pg-boss error", err));
    await boss.start();
    await boss.createQueue(REMINDER_QUEUE);

    await boss.work(REMINDER_QUEUE, async () => {
      await this.requests.runReminders();
    });

    const cron = this.config.get<string>("REMINDER_CRON") || "0 * * * *";
    await boss.schedule(REMINDER_QUEUE, cron);

    this.boss = boss;
    this.logger.log(`Reminder scheduler started (cron "${cron}").`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop();
  }
}

@Module({
  imports: [DataRequestsModule],
  providers: [QueueService],
})
export class QueueModule {}

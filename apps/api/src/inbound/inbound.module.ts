import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { QueueModule } from "../queue/queue.module";
import { StorageModule } from "../storage/storage.module";
import { InboundController } from "./inbound.controller";
import { InboundService } from "./inbound.service";

@Module({
  imports: [StorageModule, QueueModule, AiModule],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}

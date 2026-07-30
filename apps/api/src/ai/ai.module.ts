import { Module } from "@nestjs/common";
import { FieldValuesModule } from "../field-values/field-values.module";
import { StorageModule } from "../storage/storage.module";
import { AiExtractionService } from "./ai-extraction.service";
import { AnthropicService } from "./anthropic.service";

@Module({
  imports: [FieldValuesModule, StorageModule],
  providers: [AnthropicService, AiExtractionService],
  exports: [AiExtractionService],
})
export class AiModule {}

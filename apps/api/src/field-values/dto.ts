import { Allow, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Value payloads are validated structurally against the schema in the service,
 * not here. `@Allow()` keeps the free-form `value` from being stripped by the
 * global whitelisting ValidationPipe.
 */
export class ConfirmFieldDto {
  /** Optional corrected value ("popravi") applied at confirmation. */
  @IsOptional()
  @Allow()
  value?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectFieldDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ManualSetFieldDto {
  @Allow()
  value!: unknown;
}

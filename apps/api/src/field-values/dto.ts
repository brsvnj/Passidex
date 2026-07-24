import { IsOptional, IsString, MaxLength } from "class-validator";

/** Value payloads are validated structurally against the schema in the service. */
export class ConfirmFieldDto {
  /** Optional corrected value ("popravi") applied at confirmation. */
  @IsOptional()
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
  value!: unknown;
}

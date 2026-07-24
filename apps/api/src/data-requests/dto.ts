import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateDataRequestDto {
  @IsString()
  productId!: string;

  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  componentId?: string;

  /**
   * Explicit field keys to request. When omitted, Passidex auto-selects every
   * supplier-provided field that is still MISSING for the product.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  fieldKeys?: string[];

  /** Override language (BCP-47). Defaults to the supplier's language, else sl. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}

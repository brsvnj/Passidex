import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @IsString()
  @MinLength(1)
  categoryKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  gtin?: string;
}

export class CreateComponentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

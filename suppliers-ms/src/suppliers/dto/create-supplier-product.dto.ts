import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsPositive,
  Min,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

function trimToNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export class CreateSupplierProductDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  supplier_id: number;

  @ApiProperty({
    required: false,
    description:
      'ID produs din nomenclatorul de stoc (client Manual / legătură depozit). Opțional pentru catalogul comercial al furnizorului cu cont.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @IsPositive()
  product_id?: number | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  product_name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  product_description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  unit_of_measure: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price_per_unit: number;

  @ApiProperty({
    required: false,
    description: 'Cantitatea pentru care se aplică prețul (ex. 100 pentru 2.50 lei / 100 gr). Lipsă = 1.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price_base_quantity?: number | null;

  @ApiProperty({
    required: false,
    description: 'Unitatea bazei de preț (ex. gr). Lipsă = unit_of_measure.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  price_base_unit?: string | null;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  vat?: number;

  @ApiProperty({ required: false, readOnly: true, description: 'Calculat automat: price_per_unit + (price_per_unit * vat / 100)' })
  final_price?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ required: false, description: 'Cantitate neta totala disponibila la furnizor (stoc furnizor)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  net_quantity?: number | null;

  @ApiProperty({ required: false, description: 'Cantitate bruta totala disponibila la furnizor (stoc furnizor)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  gross_quantity?: number | null;

  @ApiProperty({ required: false, description: 'URL imagine produs' })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({
    required: false,
    description: 'Locație fizică în depozit (ex. Raft A3). Opțional.',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => trimToNull(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  storage_location?: string | null;
}

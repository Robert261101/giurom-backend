import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateSupplierProductDto } from './create-supplier-product.dto';

function trimToNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export class UpdateSupplierProductDto extends PartialType(CreateSupplierProductDto) {
  /** Explicit pe update — PartialType poate pierde Transform pe unele versiuni Nest. */
  @ApiPropertyOptional({
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

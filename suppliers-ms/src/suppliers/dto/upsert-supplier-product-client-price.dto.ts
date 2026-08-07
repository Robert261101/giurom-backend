import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive, ValidateIf } from 'class-validator';

export class UpsertSupplierProductClientPriceDto {
  @ApiPropertyOptional({
    description:
      'Preț preferențial fără TVA (sursă canonică). Obligatoriu dacă nu trimiteți preferred_price_with_vat.',
  })
  @ValidateIf((o) => o.preferred_price_with_vat == null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  preferred_price?: number;

  @ApiPropertyOptional({
    description:
      'Preț preferențial cu TVA. Backend-ul derivează preferred_price fără TVA din vat_rate-ul produsului.',
  })
  @ValidateIf((o) => o.preferred_price == null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  preferred_price_with_vat?: number;

  @ApiProperty({
    description: 'Câmpul editat de utilizator: without_vat | with_vat',
    enum: ['without_vat', 'with_vat'],
  })
  @IsIn(['without_vat', 'with_vat'])
  edit_source: 'without_vat' | 'with_vat';
}

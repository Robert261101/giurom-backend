import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, Min, Length } from 'class-validator';

export class CreateSupplierProductMeasurementVariantDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  supplier_product_id: number;

  @ApiProperty({ example: 'Cutie (12buc)', description: 'Eticheta variantei de masura' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  variant_label: string;

  @ApiProperty({ example: 12, description: 'Cantitate neta per variant' })
  @IsNumber()
  @Min(0)
  net_quantity: number;

  @ApiProperty({ required: false, example: 12.5, description: 'Cantitate bruta per variant (optional)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  gross_quantity?: number;

  @ApiProperty({ required: false, example: 'buc', description: 'Unitate de masura pentru aceasta varianta' })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  measurement_unit?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, IsPositive, Length, Min } from 'class-validator';

export class CreateSupplierProductDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  supplier_id: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  product_id: number;

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
  @IsNumber()
  @IsOptional()
  @Min(0)
  net_quantity?: number;

  @ApiProperty({ required: false, description: 'Cantitate bruta totala disponibila la furnizor (stoc furnizor)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  gross_quantity?: number;

  @ApiProperty({ required: false, description: 'URL imagine produs' })
  @IsString()
  @IsOptional()
  image_url?: string;

}



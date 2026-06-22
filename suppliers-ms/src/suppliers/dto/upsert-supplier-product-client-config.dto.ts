import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateIf,
} from 'class-validator';

export class UpsertSupplierProductClientConfigDto {
  @ApiProperty({
    description: 'ID produs nomenclator client (stock.products.id)',
  })
  @IsNumber()
  @IsPositive()
  client_stock_product_id: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf(
    (_o, value) => value !== null && value !== undefined && value !== '',
  )
  @IsNumber()
  @IsPositive()
  gross_quantity?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf(
    (_o, value) => value !== null && value !== undefined && value !== '',
  )
  @IsNumber()
  @IsPositive()
  net_quantity?: number | null;
}

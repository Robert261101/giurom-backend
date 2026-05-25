import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsEnum,
  IsOptional,
  IsPositive,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../entities/supplier-order.entity';

export class CreateSupplierOrderItemDto {
  @ApiProperty({
    description: 'ID produs intern stoc (stock.products.id) — ținta recepției',
  })
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty({
    description: 'ID rând nomenclatură furnizor (supplier_products.id)',
  })
  @IsNumber()
  @IsPositive()
  supplier_product_id: number;

  @ApiProperty({
    description: 'Variantă măsură (supplier_product_measurement_variants.id)',
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  variant_id?: number;

  @ApiProperty({ description: 'Cantitate bruta (greutate bruta cu ambalaj)' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Preț unitar (de obicei din nomenclatura furnizorului)' })
  @IsNumber()
  @IsPositive()
  price_per_unit: number;
}

export class CreateSupplierOrderDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  supplier_id: number;

  @ApiProperty()
  @IsDateString()
  order_date: string;

  @ApiProperty()
  @IsDateString()
  delivery_date: string;

  @ApiProperty({ enum: OrderStatus, required: false })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  created_by_user_id: number;

  @ApiProperty({ required: false, description: 'ID-ul locației pentru care se face comanda' })
  @IsNumber()
  @IsOptional()
  supplier_location_id?: number;

  @ApiProperty({ required: false, description: 'ID-ul companiei selectate la creare' })
  @IsNumber()
  @IsOptional()
  company_id?: number;

  @ApiProperty({ required: false, description: 'ID-ul locației selectate la creare' })
  @IsNumber()
  @IsOptional()
  location_id?: number;

  @ApiProperty({ type: [CreateSupplierOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierOrderItemDto)
  items: CreateSupplierOrderItemDto[];
}

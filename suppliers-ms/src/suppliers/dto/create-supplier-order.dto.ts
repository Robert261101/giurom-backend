import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsDateString, IsEnum, IsOptional, IsPositive, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../entities/supplier-order.entity';

export class CreateSupplierOrderItemDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty()
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

  @ApiProperty({ type: [CreateSupplierOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierOrderItemDto)
  items: CreateSupplierOrderItemDto[];
}



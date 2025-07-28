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
  @ApiProperty({ description: 'ID produs', example: 1 })
  @IsNumber({}, { message: 'product_id trebuie să fie un număr' })
  @IsPositive({ message: 'product_id trebuie să fie pozitiv' })
  product_id: number;

  @ApiProperty({ description: 'Cantitatea comandată', example: 50.5 })
  @IsNumber({}, { message: 'Cantitatea trebuie să fie un număr' })
  @IsPositive({ message: 'Cantitatea trebuie să fie pozitivă' })
  quantity: number;

  @ApiProperty({ description: 'Prețul pe unitate', example: 25.75 })
  @IsNumber({}, { message: 'Prețul pe unitate trebuie să fie un număr' })
  @IsPositive({ message: 'Prețul pe unitate trebuie să fie pozitiv' })
  price_per_unit: number;
}

export class CreateSupplierOrderDto {
  @ApiProperty({ description: 'ID furnizor', example: 1 })
  @IsNumber({}, { message: 'supplier_id trebuie să fie un număr' })
  @IsPositive({ message: 'supplier_id trebuie să fie pozitiv' })
  supplier_id: number;

  @ApiProperty({ description: 'Data comenzii', example: '2024-07-25T10:00:00Z' })
  @IsDateString({}, { message: 'Data comenzii trebuie să fie în format ISO' })
  order_date: string;

  @ApiProperty({ description: 'Data estimată de livrare', example: '2024-07-30T10:00:00Z' })
  @IsDateString({}, { message: 'Data de livrare trebuie să fie în format ISO' })
  delivery_date: string;

  @ApiProperty({ description: 'Statusul comenzii', enum: OrderStatus, example: OrderStatus.DRAFT, required: false })
  @IsEnum(OrderStatus, { message: 'Statusul comenzii nu este valid' })
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ description: 'Note despre comandă', example: 'Livrare urgentă', required: false })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'ID utilizator care a creat comanda', example: 1 })
  @IsNumber({}, { message: 'created_by_user_id trebuie să fie un număr' })
  @IsPositive({ message: 'created_by_user_id trebuie să fie pozitiv' })
  created_by_user_id: number;

  @ApiProperty({ description: 'Lista produselor comandate', type: [CreateSupplierOrderItemDto] })
  @IsArray({ message: 'Items trebuie să fie un array' })
  @ArrayMinSize(1, { message: 'Comanda trebuie să conțină cel puțin un produs' })
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierOrderItemDto)
  items: CreateSupplierOrderItemDto[];
}
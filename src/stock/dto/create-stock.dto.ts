import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsEnum, IsDate, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { StockStatus } from '../entities/stock.entity';

export class CreateStockDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  supplier_order_item_id?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  location_id?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  entry_date: Date;

  @ApiProperty({ required: false })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  expiration_date?: Date;

  @ApiProperty({ required: false, enum: StockStatus })
  @IsEnum(StockStatus)
  @IsOptional()
  status?: StockStatus;
}



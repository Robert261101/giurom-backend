import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsEnum, IsDate, IsOptional, Min, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { StockStatus } from '../entities/stock.entity';

export class CreateStockDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty({ required: false, description: 'Location ID reference (no FK)' })
  @IsNumber()
  @IsOptional()
  location_id?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  supplier_order_item_id?: number;

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

  @ApiProperty({ required: false, description: 'Optional URL to an attached document (PDF) for this stock entry' })
  @IsString()
  @IsOptional()
  @Length(1, 1024)
  document_url?: string;

  @ApiProperty({ required: false, description: 'Source of the stock entry', enum: ['manual','comanda'] })
  @IsEnum(['manual','comanda'] as any)
  @IsOptional()
  source?: 'manual' | 'comanda';
}



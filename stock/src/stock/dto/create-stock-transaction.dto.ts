import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsEnum,
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsDate,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TransactionType } from '../entities/stock-transaction.entity';
import { StockLotStatus, StockSource } from '../entities/stock.entity';

export class CreateStockTransactionDto {
  @ApiProperty({ description: 'Aggregate stock row id (product+location total)' })
  @IsNumber()
  @IsPositive()
  stock_id: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  location: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(1, 150)
  target?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  entry_date?: Date;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  expiration_date?: Date;

  @ApiPropertyOptional({ enum: StockSource })
  @IsEnum(StockSource)
  @IsOptional()
  source?: StockSource;

  @ApiPropertyOptional({ enum: StockLotStatus })
  @IsEnum(StockLotStatus)
  @IsOptional()
  status?: StockLotStatus;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  supplier_order_item_id?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(1, 1024)
  document_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(1, 50)
  reference_type?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  reference_id?: number;
}

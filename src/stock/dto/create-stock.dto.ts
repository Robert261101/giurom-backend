import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsEnum, IsDate, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { StockStatus } from '../entities/stock.entity';

export class CreateStockDto {
  @ApiProperty({ description: 'ID produs', example: 1 })
  @IsNumber()
  @IsPositive()
  product_id: number;



  @ApiProperty({ description: 'Cantitate', example: 100 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Preț unitar', example: 3.5 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Data intrării', example: '2024-07-01T10:00:00Z' })
  @Transform(({ value }) => new Date(value))
  @IsDate()
  entry_date: Date;

  @ApiProperty({ description: 'Data expirării', example: '2024-09-01T00:00:00Z', required: false })
  @Transform(({ value }) => value ? new Date(value) : undefined)
  @IsDate()
  @IsOptional()
  expiration_date?: Date;

  @ApiProperty({ description: 'Status', enum: StockStatus, required: false })
  @IsEnum(StockStatus)
  @IsOptional()
  status?: StockStatus;
} 
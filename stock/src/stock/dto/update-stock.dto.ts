import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { StockStatus } from '../entities/stock.entity';

/** Updates aggregate stock row only (not movement history). */
export class UpdateStockDto {
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ enum: StockStatus })
  @IsEnum(StockStatus)
  @IsOptional()
  status?: StockStatus;
}

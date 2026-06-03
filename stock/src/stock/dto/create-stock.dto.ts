import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsEnum,
  IsDate,
  IsOptional,
  Min,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StockLotStatus } from '../entities/stock.entity';

/** Creates an ENTRY movement and increases aggregate stock for product+location. */
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

  @ApiProperty({ required: false, enum: StockLotStatus })
  @IsEnum(StockLotStatus)
  @IsOptional()
  status?: StockLotStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(1, 1024)
  document_url?: string;

  @ApiProperty({ required: false, enum: ['manual', 'comanda'] })
  @IsEnum(['manual', 'comanda'] as const)
  @IsOptional()
  source?: 'manual' | 'comanda';

  @ApiProperty({
    required: false,
    description: 'Idempotency key for supplier receptions / manual entries',
  })
  @IsString()
  @IsOptional()
  @Length(1, 150)
  target?: string;
}

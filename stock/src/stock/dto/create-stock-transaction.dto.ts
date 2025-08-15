import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsEnum, IsString, IsNotEmpty, Length } from 'class-validator';
import { TransactionType } from '../entities/stock-transaction.entity';

export class CreateStockTransactionDto {
  @ApiProperty()
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
  @Length(2, 150)
  location: string;

  @ApiProperty({ required: false })
  @IsString()
  @Length(2, 150)
  target?: string;
}



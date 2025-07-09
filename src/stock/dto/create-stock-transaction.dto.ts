import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsEnum, IsString, IsNotEmpty, Length } from 'class-validator';
import { TransactionType } from '../entities/stock-transaction.entity';

export class CreateStockTransactionDto {
  @ApiProperty({ description: 'ID stoc', example: 1 })
  @IsNumber()
  @IsPositive()
  stock_id: number;

  @ApiProperty({ description: 'Tip tranzacție', enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ description: 'Cantitate', example: 10 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Locația', example: 'Bucătărie', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  location: string;

  @ApiProperty({ description: 'Destinația', example: 'Rețeta Supă', maxLength: 150, required: false })
  @IsString()
  @Length(2, 150)
  target?: string;
} 
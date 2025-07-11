import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, IsInt, Length, IsString } from 'class-validator';

export class CreateWasteRecordDto {
  @ApiProperty({ description: 'ID produs', required: false })
  @IsInt()
  @IsPositive()
  @IsOptional()
  product_id?: number;

  @ApiProperty({ description: 'ID rețetă', required: false })
  @IsInt()
  @IsPositive()
  @IsOptional()
  recipe_id?: number;

  @ApiProperty({ description: 'Cantitate', example: 5 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unitate', example: 'kg' })
  @IsString()
  @Length(1, 20)
  unit: string;

  @ApiProperty({ description: 'Motiv', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
} 
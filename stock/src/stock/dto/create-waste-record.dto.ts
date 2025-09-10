import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateWasteRecordDto {
  @ApiProperty({ description: 'ID of the product that was wasted' })
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty({ description: 'Location ID reference (no FK)', required: false })
  @IsNumber()
  @IsOptional()
  location_id?: number;

  @ApiProperty({ description: 'ID of the recipe (if waste occurred during recipe preparation)', required: false })
  @IsNumber()
  @IsOptional()
  recipe_id?: number;

  @ApiProperty({ description: 'Quantity of product wasted' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement for the wasted quantity' })
  @IsString()
  unit: string;

  @ApiProperty({ description: 'Reason for waste', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
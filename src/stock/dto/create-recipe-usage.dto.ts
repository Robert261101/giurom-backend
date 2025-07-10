import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, Min } from 'class-validator';

export class CreateRecipeUsageDto {
  @ApiProperty({ description: 'ID produs', example: 1 })
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty({ description: 'ID rețetă', example: 1 })
  @IsNumber()
  @IsPositive()
  recipe_id: number;

  @ApiProperty({ description: 'Procent', example: 12.5 })
  @IsNumber()
  @Min(0)
  percentage: number;

  @ApiProperty({ description: 'Cantitate folosită', example: 150.75 })
  @IsNumber()
  @Min(0)
  quantity_used: number;
} 
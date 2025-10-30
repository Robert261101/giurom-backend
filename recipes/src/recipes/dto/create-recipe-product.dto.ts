import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRecipeProductDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  recipe_id: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  product_id: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}



import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, IsDateString } from 'class-validator';

export class CreateRecipePreparationDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  recipe_id: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  employee_id?: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  produced_at?: string;
}



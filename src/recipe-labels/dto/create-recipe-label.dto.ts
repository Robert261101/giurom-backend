import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class CreateRecipeLabelDto {
  @ApiProperty({ description: 'ID preparation', example: 10 })
  @IsInt()
  @IsPositive()
  recipe_preparation_id: number;

  // Manual creation may allow custom code/path but optional
  @ApiProperty({ description: 'Cod etichetă (opțional, altfel se generează)', required: false })
  @IsOptional()
  label_code?: string;
} 
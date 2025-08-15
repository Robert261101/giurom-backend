import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRecipeLabelDto {
  @ApiProperty()
  @IsNumber()
  recipe_preparation_id: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  label_code?: string;
}



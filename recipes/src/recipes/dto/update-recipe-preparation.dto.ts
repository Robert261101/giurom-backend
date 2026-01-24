import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { CreateRecipePreparationDto } from './create-recipe-preparation.dto';

export class UpdateRecipePreparationDto extends PartialType(CreateRecipePreparationDto) {
  @ApiProperty({ required: false, enum: ['active', 'consumed', 'wasted'], description: 'Status of the preparation' })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'consumed', 'wasted'])
  status?: string;
}



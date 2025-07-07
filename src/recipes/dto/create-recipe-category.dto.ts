import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
} from 'class-validator';

export class CreateRecipeCategoryDto {
  @ApiProperty({
    description: 'Numele categoriei de rețete',
    example: 'Supe și Ciorbe',
    maxLength: 100,
  })
  @IsString({ message: 'Numele categoriei trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele categoriei este obligatoriu' })
  @Length(2, 100, { message: 'Numele categoriei trebuie să aibă între 2 și 100 de caractere' })
  name: string;

  @ApiProperty({
    description: 'Descrierea categoriei',
    example: 'Rețete pentru supe, ciorbe și mâncăruri lichide',
    required: false,
  })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Descrierea nu poate depăși 1000 de caractere' })
  description?: string;
} 
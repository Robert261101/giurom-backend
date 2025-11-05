import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsHexColor,
} from 'class-validator';

export class CreateEventCategoryDto {
  @ApiProperty({ 
    description: 'Numele categoriei', 
    example: 'Personal',
    maxLength: 100 
  })
  @IsString({ message: 'Numele categoriei trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele categoriei este obligatoriu' })
  @Length(1, 100, { message: 'Numele categoriei trebuie să aibă între 1 și 100 de caractere' })
  name: string;

  @ApiProperty({ 
    description: 'Culoarea asociată categoriei (pentru UI)', 
    example: 'purple',
    maxLength: 50,
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Culoarea trebuie să fie un string' })
  @Length(1, 50, { message: 'Culoarea trebuie să aibă între 1 și 50 de caractere' })
  color?: string;

  @ApiProperty({ 
    description: 'Descrierea categoriei', 
    example: 'Evenimente personale',
    maxLength: 255,
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @Length(1, 255, { message: 'Descrierea trebuie să aibă între 1 și 255 de caractere' })
  description?: string;
}
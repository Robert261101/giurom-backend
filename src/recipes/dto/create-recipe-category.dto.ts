import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
} from 'class-validator';

export class CreateRecipeCategoryDto {
  @ApiProperty({
    description: 'Numele categoriei de rețete',
    example: 'Supe și Ciorbe',
    maxLength: 150,
  })
  @IsString({ message: 'Numele categoriei trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele categoriei este obligatoriu' })
  @Length(2, 150, { message: 'Numele categoriei trebuie să aibă între 2 și 150 de caractere' })
  name: string;
} 
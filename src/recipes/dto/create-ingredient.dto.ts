import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
} from 'class-validator';

export class CreateIngredientDto {
  @ApiProperty({
    description: 'Numele ingredientului',
    example: 'Cartofi',
    maxLength: 100,
  })
  @IsString({ message: 'Numele ingredientului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele ingredientului este obligatoriu' })
  @Length(2, 100, { message: 'Numele ingredientului trebuie să aibă între 2 și 100 de caractere' })
  name: string;

  @ApiProperty({
    description: 'Descrierea ingredientului',
    example: 'Cartofi proaspeți, ideal pentru gătit',
    required: false,
  })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Descrierea nu poate depăși 1000 de caractere' })
  description?: string;

  @ApiProperty({
    description: 'Unitatea de măsură',
    example: 'grame',
    maxLength: 50,
    required: false,
  })
  @IsString({ message: 'Unitatea de măsură trebuie să fie un string' })
  @IsOptional()
  @Length(1, 50, { message: 'Unitatea de măsură trebuie să aibă între 1 și 50 de caractere' })
  unit?: string;

  @ApiProperty({
    description: 'Categoría ingredientului',
    example: 'Legume',
    maxLength: 50,
    required: false,
  })
  @IsString({ message: 'Categoria trebuie să fie un string' })
  @IsOptional()
  @Length(1, 50, { message: 'Categoria trebuie să aibă între 1 și 50 de caractere' })
  category?: string;
} 
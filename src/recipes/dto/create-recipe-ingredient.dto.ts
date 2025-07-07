import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateRecipeIngredientDto {
  @ApiProperty({
    description: 'ID-ul rețetei',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul rețetei trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul rețetei este obligatoriu' })
  @IsPositive({ message: 'ID-ul rețetei trebuie să fie pozitiv' })
  recipe_id: number;

  @ApiProperty({
    description: 'ID-ul ingredientului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul ingredientului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul ingredientului este obligatoriu' })
  @IsPositive({ message: 'ID-ul ingredientului trebuie să fie pozitiv' })
  ingredient_id: number;

  @ApiProperty({
    description: 'Cantitatea în grame',
    example: 500,
  })
  @IsNumber({}, { message: 'Cantitatea trebuie să fie un număr' })
  @IsNotEmpty({ message: 'Cantitatea este obligatorie' })
  @Min(0.1, { message: 'Cantitatea trebuie să fie cel puțin 0.1 grame' })
  @Max(10000, { message: 'Cantitatea nu poate depăși 10 kg (10000 grame)' })
  quantity_grams: number;

  @ApiProperty({
    description: 'Note suplimentare despre ingredient în rețetă',
    example: 'Tăiați cubulețe mici',
    required: false,
  })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
} 
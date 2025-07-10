import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsEnum,
  IsUrl,
  Length,
  Min,
  Max,
} from 'class-validator';
import { DifficultyLevel } from '../entities/recipe.entity';

export class CreateRecipeDto {
  constructor() {
    console.log('CreateRecipeDto constructor called');
  }

  @ApiProperty({
    description: 'Numele rețetei',
    example: 'Supă de legume cu cartofi',
    maxLength: 200,
  })
  @IsString({ message: 'Numele rețetei trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele rețetei este obligatoriu' })
  // Temporarily comment out Length validator to see if that's the issue
  // @Length(2, 200, { message: 'Numele rețetei trebuie să aibă între 2 și 200 de caractere' })
  name: string;

  @ApiProperty({
    description: 'Descrierea rețetei',
    example: 'O supă delicioasă și nutritivă, perfectă pentru zilele reci',
  })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Descrierea este obligatorie' })
  @Length(10, 5000, { message: 'Descrierea trebuie să aibă între 10 și 5000 de caractere' })
  description: string;

  @ApiProperty({
    description: 'Instrucțiunile de preparare',
    example: '1. Spălați legumele...\n2. Tăiați cartofii...\n3. Puneți totul la fiert...',
  })
  @IsString({ message: 'Instrucțiunile trebuie să fie un string' })
  @IsNotEmpty({ message: 'Instrucțiunile sunt obligatorii' })
  @Length(20, 10000, { message: 'Instrucțiunile trebuie să aibă între 20 și 10000 de caractere' })
  instructions: string;

  @ApiProperty({
    description: 'ID-ul categoriei din care face parte rețeta',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul categoriei trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul categoriei este obligatoriu' })
  @IsPositive({ message: 'ID-ul categoriei trebuie să fie pozitiv' })
  category_id: number;

  @ApiProperty({
    description: 'Timpul de preparare în minute',
    example: 30,
  })
  @IsNumber({}, { message: 'Timpul de preparare trebuie să fie un număr' })
  @IsNotEmpty({ message: 'Timpul de preparare este obligatoriu' })
  @Min(1, { message: 'Timpul de preparare trebuie să fie cel puțin 1 minut' })
  @Max(1440, { message: 'Timpul de preparare nu poate depăși 24 ore (1440 minute)' })
  preparation_time: number;

  @ApiProperty({
    description: 'Timpul de gătire în minute',
    example: 45,
  })
  @IsNumber({}, { message: 'Timpul de gătire trebuie să fie un număr' })
  @IsNotEmpty({ message: 'Timpul de gătire este obligatoriu' })
  @Min(1, { message: 'Timpul de gătire trebuie să fie cel puțin 1 minut' })
  @Max(1440, { message: 'Timpul de gătire nu poate depăși 24 ore (1440 minute)' })
  cooking_time: number;

  @ApiProperty({
    description: 'Numărul de porții',
    example: 4,
  })
  @IsNumber({}, { message: 'Numărul de porții trebuie să fie un număr' })
  @IsNotEmpty({ message: 'Numărul de porții este obligatoriu' })
  @Min(1, { message: 'Numărul de porții trebuie să fie cel puțin 1' })
  @Max(100, { message: 'Numărul de porții nu poate depăși 100' })
  servings: number;

  @ApiProperty({
    description: 'Nivelul de dificultate',
    enum: DifficultyLevel,
    example: DifficultyLevel.EASY,
  })
  @IsEnum(DifficultyLevel, { message: 'Nivelul de dificultate trebuie să fie easy, medium sau hard' })
  @IsNotEmpty({ message: 'Nivelul de dificultate este obligatoriu' })
  difficulty: DifficultyLevel;

  @ApiProperty({
    description: 'Calorii per porție',
    example: 250,
    required: false,
  })
  @IsNumber({}, { message: 'Caloriile trebuie să fie un număr' })
  @IsOptional()
  @Min(1, { message: 'Caloriile trebuie să fie cel puțin 1' })
  @Max(5000, { message: 'Caloriile nu pot depăși 5000 per porție' })
  calories_per_serving?: number;

  @ApiProperty({
    description: 'Link către imagini cu rețeta',
    example: 'https://example.com/recipe-image.jpg',
    required: false,
  })
  @IsString({ message: 'Link-ul către imagine trebuie să fie un string' })
  @IsOptional()
  @IsUrl({}, { message: 'Link-ul către imagine trebuie să fie o URL validă' })
  @Length(10, 500, { message: 'Link-ul trebuie să aibă între 10 și 500 de caractere' })
  image_url?: string;

  @ApiProperty({
    description: 'Autorul rețetei',
    example: 'Chef Maria',
    maxLength: 100,
    required: false,
  })
  @IsString({ message: 'Autorul trebuie să fie un string' })
  @IsOptional()
  @Length(2, 100, { message: 'Numele autorului trebuie să aibă între 2 și 100 de caractere' })
  author?: string;

  @ApiProperty({
    description: 'Număr de zile până la expirare după preparare',
    example: 7,
    required: false,
  })
  @IsNumber({}, { message: 'expiration_days trebuie să fie număr' })
  @IsOptional()
  @Min(1, { message: 'expiration_days trebuie să fie cel puțin 1' })
  @Max(365, { message: 'expiration_days nu poate depăși 365' })
  expiration_days?: number;
} 
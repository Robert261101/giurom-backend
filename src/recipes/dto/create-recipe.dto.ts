import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateRecipeDto {
  constructor() {
    console.log('CreateRecipeDto constructor called');
  }

  @ApiProperty({
    description: 'Numele rețetei',
    example: 'Pizza Margherita',
    maxLength: 150,
  })
  @IsString({ message: 'Numele rețetei trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele rețetei este obligatoriu' })
  @Length(2, 150, { message: 'Numele rețetei trebuie să aibă între 2 și 150 de caractere' })
  name: string;

  @ApiProperty({
    description: 'Descrierea și instrucțiunile de preparare',
    example: '1. Întinde aluatul...\n2. Adaugă sosul de roșii...\n3. Presară mozzarella...',
  })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Descrierea este obligatorie' })
  description: string;

  @ApiProperty({
    description: 'ID-ul categoriei din care face parte rețeta',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul categoriei trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul categoriei este obligatoriu' })
  @IsPositive({ message: 'ID-ul categoriei trebuie să fie pozitiv' })
  category_id: number;

  @ApiProperty({
    description: 'Număr de ore până la expirare după preparare',
    example: 48,
  })
  @IsNumber({}, { message: 'expiration_days trebuie să fie număr' })
  @IsNotEmpty({ message: 'expiration_days este obligatoriu' })
  @Min(1, { message: 'expiration_days trebuie să fie cel puțin 1 oră' })
  @Max(8760, { message: 'expiration_days nu poate depăși 8760 ore (1 an)' })
  expiration_days: number;

  @ApiProperty({
    description: 'Cantitatea finală a rețetei în grame',
    example: 1500,
  })
  @IsNumber({}, { message: 'Cantitatea trebuie să fie un număr' })
  @IsNotEmpty({ message: 'Cantitatea este obligatorie' })
  @Min(1, { message: 'Cantitatea trebuie să fie cel puțin 1 gram' })
  @Max(50000, { message: 'Cantitatea nu poate depăși 50kg (50000g)' })
  quantity: number;
} 
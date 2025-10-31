import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  Length,
  Matches,
  IsIn,
  IsNumber,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'Prenumele angajatului',
    example: 'Ion',
    maxLength: 50,
  })
  @IsString({ message: 'Prenumele trebuie să fie un string' })
  @IsNotEmpty({ message: 'Prenumele este obligatoriu' })
  @Length(2, 50, { message: 'Prenumele trebuie să aibă între 2 și 50 de caractere' })
  first_name: string;

  @ApiProperty({
    description: 'Numele de familie al angajatului',
    example: 'Popescu',
    maxLength: 50,
  })
  @IsString({ message: 'Numele de familie trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele de familie este obligatoriu' })
  @Length(2, 50, { message: 'Numele de familie trebuie să aibă între 2 și 50 de caractere' })
  last_name: string;

  @ApiProperty({
    description: 'Adresa de email a angajatului',
    example: 'ion.popescu@giurom.ro',
    maxLength: 50,
  })
  @IsEmail({}, { message: 'Adresa de email nu este validă' })
  @IsNotEmpty({ message: 'Email-ul este obligatoriu' })
  @Length(5, 50, { message: 'Email-ul trebuie să aibă între 5 și 50 de caractere' })
  email: string;

  @ApiProperty({
    description: 'Numărul de telefon al angajatului',
    example: '+40712345678',
    maxLength: 20,
  })
  @IsString({ message: 'Numărul de telefon trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numărul de telefon este obligatoriu' })
  @Matches(/^\+40\d{9}$/, { message: 'Numărul de telefon trebuie să aibă formatul +40xxxxxxxxx' })
  phone: string;

  @ApiProperty({
    description: 'Numărul personal (CNP)',
    example: '1900515123456',
    maxLength: 15,
  })
  @IsString({ message: 'Numărul personal trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numărul personal este obligatoriu' })
  @Matches(/^\d{13}$/, { message: 'Numărul personal trebuie să conțină exact 13 cifre' })
  personal_number: string;

  @ApiProperty({
    description: 'Data nașterii',
    example: '1990-05-15',
  })
  @IsDateString({}, { message: 'Data nașterii trebuie să fie o dată validă (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Data nașterii este obligatorie' })
  birth_date: string;

  @ApiProperty({
    description: 'Genul angajatului',
    example: 'male',
    enum: ['male', 'female', 'other'],
  })
  @IsString({ message: 'Genul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Genul este obligatoriu' })
  @IsIn(['male', 'female', 'other'], {
    message: 'Genul trebuie să fie unul din: male, female, other',
  })
  gender: string;

  @ApiProperty({
    description: 'Starea civilă',
    example: 'single',
    enum: ['single', 'married', 'other'],
    required: false,
  })
  @IsString({ message: 'Starea civilă trebuie să fie un string' })
  @IsOptional()
  @IsIn(['single', 'married', 'other'], {
    message: 'Starea civilă trebuie să fie una din: single, married, other',
  })
  marital_status?: string;

  @ApiProperty({
    description: 'Naționalitatea angajatului',
    example: 'Română',
    maxLength: 50,
  })
  @IsString({ message: 'Naționalitatea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Naționalitatea este obligatorie' })
  @Length(2, 50, { message: 'Naționalitatea trebuie să aibă între 2 și 50 de caractere' })
  nationality: string;

  @ApiProperty({
    description: 'Adresa completă a angajatului',
    example: 'Str. Exemplu nr. 123, București',
  })
  @IsString({ message: 'Adresa trebuie să fie un string' })
  @IsNotEmpty({ message: 'Adresa este obligatorie' })
  @Length(10, 500, { message: 'Adresa trebuie să aibă între 10 și 500 de caractere' })
  address: string;

  @ApiProperty({
    description: 'Data angajării',
    example: '2023-01-15',
  })
  @IsDateString({}, { message: 'Data angajării trebuie să fie o dată validă (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Data angajării este obligatorie' })
  hire_date: string;

  @ApiProperty({
    description: 'Data încetării contractului',
    example: '2025-01-15',
    required: false,
  })
  @IsDateString({}, { message: 'Data încetării trebuie să fie o dată validă (YYYY-MM-DD)' })
  @IsOptional()
  termination_date?: string;

  @ApiProperty({
    description: 'ID-ul poziției implicite',
    example: 1,
    required: false,
  })
  @IsNumber({}, { message: 'ID-ul poziției trebuie să fie un număr' })
  @IsOptional()
  position_default_id?: number;

  @ApiProperty({
    description: 'ID-ul departamentului implicit',
    example: 1,
    required: false,
  })
  @IsNumber({}, { message: 'ID-ul departamentului trebuie să fie un număr' })
  @IsOptional()
  department_default_id?: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru implicite',
    example: 1,
    required: false,
  })
  @IsNumber({}, { message: 'ID-ul locației de lucru trebuie să fie un număr' })
  @IsOptional()
  work_location_default_id?: number;

  @ApiProperty({
    description: 'Tipul contractului',
    example: 'permanent',
    enum: ['permanent', 'fixed-term', 'internship'],
  })
  @IsString({ message: 'Tipul contractului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Tipul contractului este obligatoriu' })
  @IsIn(['permanent', 'fixed-term', 'internship'], {
    message: 'Tipul contractului trebuie să fie unul din: permanent, fixed-term, internship',
  })
  contract_type: string;

  @ApiProperty({
    description: 'Indică dacă angajatul este activ',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean({ message: 'Statusul activ trebuie să fie boolean' })
  @IsOptional()
  is_active?: boolean = true;

}
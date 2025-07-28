import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsBoolean,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Numele furnizorului', example: 'SC Alimentara SRL' })
  @IsString({ message: 'Numele furnizorului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele furnizorului este obligatoriu' })
  @Length(2, 200, { message: 'Numele furnizorului trebuie să aibă între 2 și 200 de caractere' })
  supplier_name: string;

  @ApiProperty({ description: 'Numărul de înregistrare', example: 'J40/12345/2020' })
  @IsString({ message: 'Numărul de înregistrare trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numărul de înregistrare este obligatoriu' })
  @Length(5, 50, { message: 'Numărul de înregistrare trebuie să aibă între 5 și 50 de caractere' })
  registration_number: string;

  @ApiProperty({ description: 'Codul fiscal', example: 'RO12345678' })
  @IsString({ message: 'Codul fiscal trebuie să fie un string' })
  @IsNotEmpty({ message: 'Codul fiscal este obligatoriu' })
  @Matches(/^[A-Z]{2}[0-9]{8,10}$/, { message: 'Codul fiscal trebuie să aibă formatul RO12345678' })
  vat_number: string;

  @ApiProperty({ description: 'Adresa', example: 'Str. Principală nr. 123' })
  @IsString({ message: 'Adresa trebuie să fie un string' })
  @IsNotEmpty({ message: 'Adresa este obligatorie' })
  @Length(5, 255, { message: 'Adresa trebuie să aibă între 5 și 255 de caractere' })
  address: string;

  @ApiProperty({ description: 'Orașul', example: 'București' })
  @IsString({ message: 'Orașul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Orașul este obligatoriu' })
  @Length(2, 100, { message: 'Orașul trebuie să aibă între 2 și 100 de caractere' })
  city: string;

  @ApiProperty({ description: 'Regiunea/Județul', example: 'Ilfov' })
  @IsString({ message: 'Regiunea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Regiunea este obligatorie' })
  @Length(2, 100, { message: 'Regiunea trebuie să aibă între 2 și 100 de caractere' })
  region: string;

  @ApiProperty({ description: 'Țara', example: 'România' })
  @IsString({ message: 'Țara trebuie să fie un string' })
  @IsNotEmpty({ message: 'Țara este obligatorie' })
  @Length(2, 100, { message: 'Țara trebuie să aibă între 2 și 100 de caractere' })
  country: string;

  @ApiProperty({ description: 'Codul poștal', example: '123456' })
  @IsString({ message: 'Codul poștal trebuie să fie un string' })
  @IsNotEmpty({ message: 'Codul poștal este obligatoriu' })
  @Length(5, 20, { message: 'Codul poștal trebuie să aibă între 5 și 20 de caractere' })
  postal_code: string;

  @ApiProperty({ description: 'Numărul de telefon', example: '+40123456789' })
  @IsString({ message: 'Numărul de telefon trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numărul de telefon este obligatoriu' })
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Numărul de telefon nu este valid' })
  phone: string;

  @ApiProperty({ description: 'Adresa de email', example: 'contact@alimentara.ro' })
  @IsEmail({}, { message: 'Adresa de email nu este validă' })
  @IsNotEmpty({ message: 'Adresa de email este obligatorie' })
  email: string;

  @ApiProperty({ description: 'Persoana de contact', example: 'Ion Popescu' })
  @IsString({ message: 'Persoana de contact trebuie să fie un string' })
  @IsNotEmpty({ message: 'Persoana de contact este obligatorie' })
  @Length(2, 150, { message: 'Persoana de contact trebuie să aibă între 2 și 150 de caractere' })
  contact_person: string;

  @ApiProperty({ description: 'Furnizorul este activ', example: true, required: false })
  @IsBoolean({ message: 'is_active trebuie să fie boolean' })
  @IsOptional()
  is_active?: boolean;
}
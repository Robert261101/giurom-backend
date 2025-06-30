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
  IsUrl,
  IsIn,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Numele companiei',
    example: 'SC Giurom SRL',
    maxLength: 255,
  })
  @IsString({ message: 'Numele companiei trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele companiei este obligatoriu' })
  @Length(2, 255, { message: 'Numele companiei trebuie să aibă între 2 și 255 de caractere' })
  company_name: string;

  @ApiProperty({
    description: 'Codul Unic de Înregistrare (CUI)',
    example: 'RO12345678',
    maxLength: 20,
  })
  @IsString({ message: 'CUI-ul trebuie să fie un string' })
  @IsNotEmpty({ message: 'CUI-ul este obligatoriu' })
  @Matches(/^RO\d{2,18}$/, { message: 'CUI-ul trebuie să aibă formatul RO urmat de 2-18 cifre' })
  cui: string;

  @ApiProperty({
    description: 'Numărul de înregistrare din registrul comerțului',
    example: 'J40/1234/2023',
    maxLength: 50,
  })
  @IsString({ message: 'Numărul de înregistrare trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numărul de înregistrare este obligatoriu' })
  @Length(5, 50, { message: 'Numărul de înregistrare trebuie să aibă între 5 și 50 de caractere' })
  trade_register_number: string;

  @ApiProperty({
    description: 'Adresa completă a companiei',
    example: 'Str. Exemplu nr. 123, Sector 1',
  })
  @IsString({ message: 'Adresa trebuie să fie un string' })
  @IsNotEmpty({ message: 'Adresa este obligatorie' })
  @Length(10, 500, { message: 'Adresa trebuie să aibă între 10 și 500 de caractere' })
  address: string;

  @ApiProperty({
    description: 'Orașul în care se află compania',
    example: 'București',
    maxLength: 100,
  })
  @IsString({ message: 'Orașul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Orașul este obligatoriu' })
  @Length(2, 100, { message: 'Orașul trebuie să aibă între 2 și 100 de caractere' })
  city: string;

  @ApiProperty({
    description: 'Județul în care se află compania',
    example: 'București',
    maxLength: 100,
    default: 'Romania',
  })
  @IsString({ message: 'Județul trebuie să fie un string' })
  @IsOptional()
  @Length(2, 100, { message: 'Județul trebuie să aibă între 2 și 100 de caractere' })
  county?: string = 'Romania';

  @ApiProperty({
    description: 'Codul poștal',
    example: '010101',
    maxLength: 20,
    required: false,
  })
  @IsString({ message: 'Codul poștal trebuie să fie un string' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Codul poștal trebuie să conțină 6 cifre' })
  postal_code?: string;

  @ApiProperty({
    description: 'Țara în care se află compania',
    example: 'Romania',
    maxLength: 100,
    default: 'Romania',
  })
  @IsString({ message: 'Țara trebuie să fie un string' })
  @IsOptional()
  @Length(2, 100, { message: 'Țara trebuie să aibă între 2 și 100 de caractere' })
  country?: string = 'Romania';

  @ApiProperty({
    description: 'Numărul de telefon al companiei',
    example: '+40712345678',
    maxLength: 20,
    required: false,
  })
  @IsString({ message: 'Numărul de telefon trebuie să fie un string' })
  @IsOptional()
  @Matches(/^\+40\d{9}$/, { message: 'Numărul de telefon trebuie să aibă formatul +40xxxxxxxxx' })
  phone_number?: string;

  @ApiProperty({
    description: 'Adresa de email a companiei',
    example: 'contact@giurom.com',
    maxLength: 255,
    required: false,
  })
  @IsEmail({}, { message: 'Adresa de email nu este validă' })
  @IsOptional()
  @Length(5, 255, { message: 'Email-ul trebuie să aibă între 5 și 255 de caractere' })
  email?: string;

  @ApiProperty({
    description: 'Data înregistrării companiei',
    example: '2023-01-15',
  })
  @IsDateString({}, { message: 'Data înregistrării trebuie să fie o dată validă (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Data înregistrării este obligatorie' })
  incorporation_date: string;

  @ApiProperty({
    description: 'Forma juridică a companiei',
    example: 'SRL',
    maxLength: 100,
    enum: ['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'],
  })
  @IsString({ message: 'Forma juridică trebuie să fie un string' })
  @IsNotEmpty({ message: 'Forma juridică este obligatorie' })
  @IsIn(['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'], {
    message: 'Forma juridică trebuie să fie una din: SRL, SA, PFA, II, IF, ONG, COOPERATIVA',
  })
  legal_form: string;

  @ApiProperty({
    description: 'Codul de activitate principal (CAEN)',
    example: '6201',
    maxLength: 10,
  })
  @IsString({ message: 'Codul de activitate trebuie să fie un string' })
  @IsNotEmpty({ message: 'Codul de activitate este obligatoriu' })
  @Matches(/^\d{4}$/, { message: 'Codul de activitate trebuie să conțină 4 cifre' })
  activity_code: string;

  @ApiProperty({
    description: 'Indică dacă compania este plătitoare de TVA',
    example: false,
    default: false,
    required: false,
  })
  @IsBoolean({ message: 'Plătitor TVA trebuie să fie boolean' })
  @IsOptional()
  vat_payer?: boolean = false;

  @ApiProperty({
    description: 'Numele băncii',
    example: 'BCR',
    maxLength: 255,
    required: false,
  })
  @IsString({ message: 'Numele băncii trebuie să fie un string' })
  @IsOptional()
  @Length(2, 255, { message: 'Numele băncii trebuie să aibă între 2 și 255 de caractere' })
  bank_name?: string;

  @ApiProperty({
    description: 'Numărul contului bancar (IBAN)',
    example: 'RO49AAAA1B31007593840000',
    maxLength: 34,
    required: false,
  })
  @IsString({ message: 'IBAN-ul trebuie să fie un string' })
  @IsOptional()
  @Matches(/^RO\d{2}[A-Z]{4}\d{16}$/, { message: 'IBAN-ul trebuie să aibă formatul românesc valid' })
  bank_account_number?: string;

  @ApiProperty({
    description: 'Site-ul web al companiei',
    example: 'https://www.giurom.com',
    maxLength: 255,
    required: false,
  })
  @IsUrl({}, { message: 'Site-ul web trebuie să fie o adresă URL validă' })
  @IsOptional()
  @Length(5, 255, { message: 'URL-ul trebuie să aibă între 5 și 255 de caractere' })
  website?: string;

  @ApiProperty({
    description: 'Statusul companiei',
    example: 'activ',
    enum: ['activ', 'inactiv', 'suspendat'],
    default: 'activ',
    required: false,
  })
  @IsString({ message: 'Statusul trebuie să fie un string' })
  @IsOptional()
  @IsIn(['activ', 'inactiv', 'suspendat'], {
    message: 'Statusul trebuie să fie unul din: activ, inactiv, suspendat',
  })
  status?: string = 'activ';

  @ApiProperty({
    description: 'Note sau observații despre companie',
    example: 'Companie nou înregistrată',
    required: false,
  })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
} 
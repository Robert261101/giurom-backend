import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsNumber, IsOptional, Length, Matches, Min, Max } from 'class-validator';

export class CreateWorkLocationDto {
  @ApiProperty({ description: 'ID-ul companiei la care aparține locația', example: 1 })
  @IsNumber({}, { message: 'ID-ul companiei trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul companiei este obligatoriu' })
  company_id: number;

  @ApiProperty({ description: 'Numele locației de lucru', example: 'Sediul Central București', maxLength: 255 })
  @IsString({ message: 'Numele locației trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele locației este obligatoriu' })
  @Length(3, 255, { message: 'Numele locației trebuie să aibă între 3 și 255 de caractere' })
  location_name: string;

  @ApiProperty({ description: 'Adresa completă a locației', example: 'Str. Exemplu nr. 123, Sector 1, București' })
  @IsString({ message: 'Adresa trebuie să fie un string' })
  @IsNotEmpty({ message: 'Adresa este obligatorie' })
  @Length(10, 500, { message: 'Adresa trebuie să aibă între 10 și 500 de caractere' })
  address: string;

  @ApiProperty({ description: 'Orașul în care se află locația', example: 'București', maxLength: 100 })
  @IsString({ message: 'Orașul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Orașul este obligatoriu' })
  @Length(2, 100, { message: 'Orașul trebuie să aibă între 2 și 100 de caractere' })
  city: string;

  @ApiProperty({ description: 'Județul în care se află locația', example: 'București', maxLength: 100 })
  @IsString({ message: 'Județul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Județul este obligatoriu' })
  @Length(2, 100, { message: 'Județul trebuie să aibă între 2 și 100 de caractere' })
  county: string;

  @ApiProperty({ description: 'Codul poștal al locației', example: '010101', maxLength: 20, required: false })
  @IsString({ message: 'Codul poștal trebuie să fie un string' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Codul poștal trebuie să conțină 6 cifre' })
  postal_code?: string;

  @ApiProperty({ description: 'Țara în care se află locația', example: 'Romania', maxLength: 100, default: 'Romania' })
  @IsString({ message: 'Țara trebuie să fie un string' })
  @IsOptional()
  @Length(2, 100, { message: 'Țara trebuie să aibă între 2 și 100 de caractere' })
  country?: string = 'Romania';

  @ApiProperty({ description: 'Numărul de telefon al locației', example: '+40212345678', maxLength: 20, required: false })
  @IsString({ message: 'Numărul de telefon trebuie să fie un string' })
  @IsOptional()
  @Matches(/^\+40\d{9}$/, { message: 'Numărul de telefon trebuie să aibă formatul +40xxxxxxxxx' })
  phone_number?: string;

  @ApiProperty({ description: 'Adresa de email pentru locația respectivă', example: 'bucuresti@giurom.com', maxLength: 255, required: false })
  @IsEmail({}, { message: 'Adresa de email nu este validă' })
  @IsOptional()
  @Length(5, 255, { message: 'Email-ul trebuie să aibă între 5 și 255 de caractere' })
  email?: string;

  @ApiProperty({ description: 'ID-ul angajatului responsabil pentru locație', example: 1, default: 1, required: false })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsOptional()
  employee_id?: number = 1;

  @ApiProperty({ description: 'Note despre locația de lucru', example: 'Sediul principal cu 50 de angajați', required: false })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;

  @ApiProperty({ description: 'Latitudinea GPS a locației', example: 44.4268, required: false })
  @IsNumber({}, { message: 'Latitudinea GPS trebuie să fie un număr' })
  @IsOptional()
  @Min(-90, { message: 'Latitudinea trebuie să fie între -90 și 90' })
  @Max(90, { message: 'Latitudinea trebuie să fie între -90 și 90' })
  gps_lat?: number;

  @ApiProperty({ description: 'Longitudinea GPS a locației', example: 26.1025, required: false })
  @IsNumber({}, { message: 'Longitudinea GPS trebuie să fie un număr' })
  @IsOptional()
  @Min(-180, { message: 'Longitudinea trebuie să fie între -180 și 180' })
  @Max(180, { message: 'Longitudinea trebuie să fie între -180 și 180' })
  gps_lng?: number;

  @ApiProperty({ description: 'Raza GPS în metri pentru geofencing', example: 50, required: false })
  @IsNumber({}, { message: 'Raza GPS trebuie să fie un număr' })
  @IsOptional()
  @Min(1, { message: 'Raza GPS trebuie să fie cel puțin 1 metru' })
  @Max(10000, { message: 'Raza GPS nu poate depăși 10000 metri' })
  gps_radius_m?: number;
} 
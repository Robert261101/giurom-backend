import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsDateString, IsBoolean, IsOptional, IsNotEmpty, Length, Matches, IsUrl, IsIn } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Numele companiei', example: 'SC Giurom SRL', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  company_name: string;

  @ApiProperty({ description: 'Codul Unic de Înregistrare (CUI)', example: 'RO12345678', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @Matches(/^RO\d{2,18}$/)
  cui: string;

  @ApiProperty({ description: 'Numărul de înregistrare din registrul comerțului', example: 'J40/1234/2023', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @Length(5, 50)
  trade_register_number: string;

  @ApiProperty({ description: 'Adresa completă a companiei', example: 'Str. Exemplu nr. 123, Sector 1' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  address: string;

  @ApiProperty({ description: 'Orașul', example: 'București', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  city: string;

  @ApiProperty({ description: 'Județ', example: 'București', maxLength: 100, default: 'Romania' })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  county?: string = 'Romania';

  @ApiProperty({ description: 'Cod poștal', example: '010101', maxLength: 20, required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{6}$/)
  postal_code?: string;

  @ApiProperty({ description: 'Țara', example: 'Romania', maxLength: 100, default: 'Romania' })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  country?: string = 'Romania';

  @ApiProperty({ description: 'Telefon', example: '+40712345678', maxLength: 20, required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+40\d{9}$/)
  phone_number?: string;

  @ApiProperty({ description: 'Email', example: 'contact@giurom.com', maxLength: 255, required: false })
  @IsEmail()
  @IsOptional()
  @Length(5, 255)
  email?: string;

  @ApiProperty({ description: 'Data înregistrării', example: '2023-01-15' })
  @IsDateString()
  @IsNotEmpty()
  incorporation_date: string;

  @ApiProperty({ description: 'Forma juridică', example: 'SRL', enum: ['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'])
  legal_form: string;

  @ApiProperty({ description: 'CAEN', example: '6201', maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/)
  activity_code: string;

  @ApiProperty({ description: 'TVA', example: false, default: false, required: false })
  @IsBoolean()
  @IsOptional()
  vat_payer?: boolean = false;

  @ApiProperty({ description: 'Banca', example: 'BCR', maxLength: 255, required: false })
  @IsString()
  @IsOptional()
  @Length(2, 255)
  bank_name?: string;

  @ApiProperty({ description: 'IBAN', example: 'RO49AAAA1B31007593840000', maxLength: 34, required: false })
  @IsString()
  @IsOptional()
  @Matches(/^RO\d{2}[A-Z]{4}\d{16}$/)
  bank_account_number?: string;

  @ApiProperty({ description: 'Website', example: 'https://www.giurom.com', maxLength: 255, required: false })
  @IsUrl()
  @IsOptional()
  @Length(5, 255)
  website?: string;

  @ApiProperty({ description: 'Status', example: 'activ', enum: ['activ', 'inactiv', 'suspendat'], default: 'activ', required: false })
  @IsString()
  @IsOptional()
  @IsIn(['activ', 'inactiv', 'suspendat'])
  status?: string = 'activ';

  @ApiProperty({ description: 'Note', example: 'Companie nou înregistrată', required: false })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  notes?: string;
} 
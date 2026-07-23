import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Date companie (companies) — creată automat la înregistrare. */
export class RegisterSupplierCompanyFieldsDto {
  @ApiProperty({ description: 'CUI/CIF (acceptă RO, spații, cratime)' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  cui!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  company_name!: string;

  @ApiProperty({ example: 'J40/1234/2023' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 50)
  trade_register_number!: string;

  @ApiProperty({ example: '6201', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/)
  activity_code?: string;

  @ApiProperty({ example: '+40712345678', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+40\d{9}$/)
  phone_number?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  @Length(5, 255)
  email?: string;

  @ApiProperty({
    enum: ['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'],
    required: false,
    default: 'SRL',
  })
  @IsString()
  @IsOptional()
  @IsIn(['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'])
  legal_form?: string;

  @ApiProperty({ example: '2023-01-15', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  incorporation_date?: string;
}

/** Date sediu / locație principală (work_location). */
export class RegisterSupplierLocationFieldsDto {
  @ApiProperty({ required: false, description: 'Implicit din localitate (ex. "Loc. <oraș>")' })
  @IsString()
  @IsOptional()
  @Length(3, 255)
  location_name?: string;

  @ApiProperty({ description: 'Stradă' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  street!: string;

  @ApiProperty({ description: 'Număr' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  number!: string;

  @ApiProperty({ description: 'Localitate' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  city!: string;

  @ApiProperty({ description: 'Județ' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  county!: string;

  @ApiProperty({ example: '010101', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{6}$/)
  postal_code?: string;

  @ApiProperty({ default: 'Romania', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  country?: string;

  @ApiProperty({ required: false, description: 'Detalii adresă (bloc, etaj etc.)' })
  @IsString()
  @IsOptional()
  @Length(0, 200)
  details?: string;
}

export class RegisterSupplierEmployeeFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  first_name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  last_name!: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @Length(5, 50)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+40\d{9}$/)
  phone!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{13}$/)
  personal_number!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  birth_date!: string;

  @ApiProperty({ enum: ['male', 'female', 'other'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['male', 'female', 'other'])
  gender!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  nationality!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  address!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hire_date!: string;

  @ApiProperty({ enum: ['permanent', 'fixed-term', 'internship'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['permanent', 'fixed-term', 'internship'])
  contract_type!: string;
}

export class RegisterSupplierDto {
  @ApiProperty({ type: RegisterSupplierCompanyFieldsDto })
  @ValidateNested()
  @Type(() => RegisterSupplierCompanyFieldsDto)
  company!: RegisterSupplierCompanyFieldsDto;

  @ApiProperty({ type: RegisterSupplierLocationFieldsDto })
  @ValidateNested()
  @Type(() => RegisterSupplierLocationFieldsDto)
  location!: RegisterSupplierLocationFieldsDto;

  @ApiProperty({ type: RegisterSupplierEmployeeFieldsDto })
  @ValidateNested()
  @Type(() => RegisterSupplierEmployeeFieldsDto)
  employee!: RegisterSupplierEmployeeFieldsDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  confirm_password!: string;

  @ApiProperty({
    required: false,
    description:
      'Token semnat emis de company-lookup; dovedește proveniența ANAF a datelor',
  })
  @IsString()
  @IsOptional()
  @Length(1, 8192)
  anaf_token?: string;
}

export class RegisterSupplierCompanyLookupDto {
  @ApiProperty({ description: 'CUI/CIF (acceptă RO, spații, cratime)' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  cui!: string;
}

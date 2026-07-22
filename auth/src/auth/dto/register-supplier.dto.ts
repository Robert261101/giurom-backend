import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RegisterSupplierSupplierFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  supplier_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(5, 50)
  registration_number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}[0-9]{8,10}$/)
  vat_number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(5, 255)
  address: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  region: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  country: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  postal_code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/)
  phone: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  contact_person: string;
}

export class RegisterSupplierEmployeeFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  first_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  last_name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @Length(5, 50)
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+40\d{9}$/)
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{13}$/)
  personal_number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  birth_date: string;

  @ApiProperty({ enum: ['male', 'female', 'other'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['male', 'female', 'other'])
  gender: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  nationality: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  address: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hire_date: string;

  @ApiProperty({ enum: ['permanent', 'fixed-term', 'internship'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['permanent', 'fixed-term', 'internship'])
  contract_type: string;
}

export class RegisterSupplierDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  company_id: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  location_id: number;

  @ApiProperty({ type: RegisterSupplierSupplierFieldsDto })
  @ValidateNested()
  @Type(() => RegisterSupplierSupplierFieldsDto)
  supplier: RegisterSupplierSupplierFieldsDto;

  @ApiProperty({ type: RegisterSupplierEmployeeFieldsDto })
  @ValidateNested()
  @Type(() => RegisterSupplierEmployeeFieldsDto)
  employee: RegisterSupplierEmployeeFieldsDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  confirm_password: string;
}

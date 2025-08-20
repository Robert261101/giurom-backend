import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsBoolean, IsOptional, Length, Matches } from 'class-validator';

export class CreateSupplierDto {
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

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}



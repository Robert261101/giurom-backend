import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  RegisterSupplierCompanyFieldsDto,
  RegisterSupplierEmployeeFieldsDto,
  RegisterSupplierLocationFieldsDto,
} from './register-supplier.dto';

/**
 * Self-registration client — aceeași formă ca supplier (company/location/employee),
 * fără câmpuri exclusiv supplier.
 */
export class RegisterClientDto {
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

export class RegisterClientCompanyLookupDto {
  @ApiProperty({ description: 'CUI/CIF (acceptă RO, spații, cratime)' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  cui!: string;
}

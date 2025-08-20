import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplierDto } from './create-supplier.dto';

export class CreateSupplierDocumentDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  size?: number;
}

export class CreateSupplierWithDocumentsDto extends CreateSupplierDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  folderName?: string;

  @ApiProperty({ type: [CreateSupplierDocumentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierDocumentDto)
  @IsOptional()
  documents?: CreateSupplierDocumentDto[];
}



import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompanyDto } from './create-company.dto';

export class CreateCompanyDocumentUploadDto {
  @ApiProperty({ description: 'Numele fișierului', example: 'certificat.pdf' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({ description: 'Numele fișierului (alternativ)', example: 'certificat.pdf' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'ID-ul documentului (opțional)', example: 'abc123' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Tipul documentului', example: 'Certificat de înmatriculare' })
  @IsString()
  @IsOptional()
  document_type?: string;

  @ApiProperty({ description: 'Nota pentru document', example: 'Document original scanat', required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ description: 'Note alternative', example: 'Document important', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Conținutul fișierului în format base64', example: 'data:application/pdf;base64,JVBERi0...', required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ description: 'Tipul MIME al fișierului', example: 'application/pdf', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'Dimensiunea fișierului în bytes', example: 245678, required: false })
  @IsNumber()
  @IsOptional()
  size?: number;
}

export class CreateCompanyWithDocumentsDto extends CreateCompanyDto {
  @ApiProperty({ 
    description: 'Lista de documente pentru încărcare', 
    type: [CreateCompanyDocumentUploadDto],
    required: false 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompanyDocumentUploadDto)
  @IsOptional()
  documents?: CreateCompanyDocumentUploadDto[];
}
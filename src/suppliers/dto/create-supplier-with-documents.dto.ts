import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, ValidateIf, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplierDto } from './create-supplier.dto';

export class CreateSupplierDocumentDto {
  @ApiProperty({ description: 'Numele fișierului', example: 'contract.pdf' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({ description: 'Numele fișierului (alternativ)', example: 'contract.pdf' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'ID-ul documentului (opțional)', example: 'abc123' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Nota pentru document', example: 'Contract de furnizare', required: false })
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

export class CreateSupplierWithDocumentsDto extends CreateSupplierDto {
  @ApiProperty({ 
    description: 'Numele folderului pentru documente', 
    example: 'Documente SC Alimentara SRL',
    required: false 
  })
  @IsString()
  @IsOptional()
  folderName?: string;

  @ApiProperty({ 
    description: 'Lista de documente pentru încărcare', 
    type: [CreateSupplierDocumentDto],
    required: false 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierDocumentDto)
  @IsOptional()
  documents?: CreateSupplierDocumentDto[];
}
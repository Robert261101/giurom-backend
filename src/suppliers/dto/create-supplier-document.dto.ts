import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { DocumentType } from '../entities/supplier-document.entity';

export class CreateSupplierDocumentDto {
  @ApiProperty({ description: 'ID folder', example: 1 })
  @IsNumber({}, { message: 'folder_id trebuie să fie un număr' })
  @IsPositive({ message: 'folder_id trebuie să fie pozitiv' })
  folder_id: number;

  @ApiProperty({ description: 'Tipul documentului', enum: DocumentType, example: DocumentType.CONTRACT })
  @IsEnum(DocumentType, { message: 'Tipul documentului nu este valid' })
  document_type: DocumentType;

  @ApiProperty({ description: 'Numele fișierului', example: 'contract_alimentara.pdf' })
  @IsString({ message: 'Numele fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele fișierului este obligatoriu' })
  file_name: string;

  @ApiProperty({ description: 'Calea fișierului în cloud', example: '/suppliers/1/alimentara-srl/data/contract_alimentara.pdf' })
  @IsString({ message: 'Calea fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Calea fișierului este obligatorie' })
  file_path: string;

  @ApiProperty({ description: 'Note despre document', example: 'Contract de furnizare valabil până în 2025', required: false })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  notes?: string;
}
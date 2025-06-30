import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  Length,
  IsIn,
} from 'class-validator';

export class CreateCompanyDocumentDto {
  @ApiProperty({
    description: 'ID-ul companiei la care aparține documentul',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul companiei trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul companiei este obligatoriu' })
  company_id: number;

  @ApiProperty({
    description: 'Numele fișierului documentului',
    example: 'certificat_inmatriculare.pdf',
    maxLength: 255,
  })
  @IsString({ message: 'Numele documentului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele documentului este obligatoriu' })
  @Length(3, 255, { message: 'Numele documentului trebuie să aibă între 3 și 255 de caractere' })
  document_name: string;

  @ApiProperty({
    description: 'Tipul documentului',
    example: 'Certificat de înmatriculare',
    enum: [
      'Certificat de înmatriculare',
      'Act constitutiv',
      'Hotărâre ANAF',
      'Contract de închiriere',
      'Procură',
      'Certificat fiscal',
      'Alte documente',
    ],
  })
  @IsString({ message: 'Tipul documentului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Tipul documentului este obligatoriu' })
  @IsIn([
    'Certificat de înmatriculare',
    'Act constitutiv',
    'Hotărâre ANAF',
    'Contract de închiriere',
    'Procură',
    'Certificat fiscal',
    'Alte documente',
  ], {
    message: 'Tipul documentului trebuie să fie unul din tipurile predefinite',
  })
  document_type: string;

  @ApiProperty({
    description: 'Calea către documentul stocat pe disk',
    example: '/uploads/documents/2023/12/certificat_1.pdf',
  })
  @IsString({ message: 'Calea documentului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Calea documentului este obligatorie' })
  @Length(5, 500, { message: 'Calea documentului trebuie să aibă între 5 și 500 de caractere' })
  location_path: string;

  @ApiProperty({
    description: 'Data încărcării documentului',
    example: '2023-01-15',
  })
  @IsDateString({}, { message: 'Data încărcării trebuie să fie o dată validă (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Data încărcării este obligatorie' })
  upload_date: string;

  @ApiProperty({
    description: 'Note despre document',
    example: 'Document original scanat',
    required: false,
  })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
} 
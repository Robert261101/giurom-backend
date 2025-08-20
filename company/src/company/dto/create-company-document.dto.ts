import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, Length, IsIn } from 'class-validator';

export class CreateCompanyDocumentDto {
  @ApiProperty({ description: 'ID-ul companiei', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  company_id: number;

  @ApiProperty({ description: 'Numele fișierului', example: 'certificat_inmatriculare.pdf', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  document_name: string;

  @ApiProperty({ description: 'Tipul documentului', example: 'Certificat de înmatriculare' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['Certificat de înmatriculare','Act constitutiv','Hotărâre ANAF','Contract de închiriere','Procură','Certificat fiscal','Alte documente'])
  document_type: string;

  @ApiProperty({ description: 'Calea către document', example: '/uploads/documents/2023/12/certificat_1.pdf' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 500)
  location_path: string;

  @ApiProperty({ description: 'Data încărcării', example: '2023-01-15' })
  @IsDateString()
  @IsNotEmpty()
  upload_date: string;

  @ApiProperty({ description: 'Note', example: 'Document original scanat', required: false })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  notes?: string;
} 
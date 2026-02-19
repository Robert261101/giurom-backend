import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWorkLocationFileDto {
  @ApiProperty({
    description: 'ID-ul locației',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul locației trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul locației este obligatoriu' })
  @Transform(({ value }) => parseInt(value, 10))
  work_location_id: number;

  @ApiProperty({
    description: 'Numele fișierului',
    example: 'Contract_Locatie_2023.pdf',
    maxLength: 255,
  })
  @IsString({ message: 'Numele fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele fișierului este obligatoriu' })
  @Length(3, 255, { message: 'Numele fișierului trebuie să aibă între 3 și 255 de caractere' })
  @Matches(/^[a-zA-Z0-9._\-\săîâșțĂÎÂȘȚ]+\.(pdf|doc|docx|jpg|jpeg|png|txt|xlsx|xls)$/i, {
    message: 'Numele fișierului trebuie să aibă o extensie validă (.pdf, .doc, .docx, .jpg, .jpeg, .png, .txt, .xlsx, .xls)'
  })
  file_name: string;

  @ApiProperty({
    description: 'Tipul fișierului',
    example: 'Contract',
    maxLength: 100,
    enum: ['Contract', 'Autorizatie', 'Certificat', 'Poza', 'Plan', 'Document_Financiar', 'Altele'],
  })
  @IsString({ message: 'Tipul fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Tipul fișierului este obligatoriu' })
  @Length(2, 100, { message: 'Tipul fișierului trebuie să aibă între 2 și 100 de caractere' })
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier sau calea de stocare',
    example: '/files/locations/1/contract_locatie.pdf',
    maxLength: 255,
  })
  @IsString({ message: 'Link-ul fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Link-ul fișierului este obligatoriu' })
  @Length(5, 255, { message: 'Link-ul fișierului trebuie să aibă între 5 și 255 de caractere' })
  @Matches(/^(\/storage\/|\/files\/|https?:\/\/|\\\\server\\)/, {
    message: 'Link-ul trebuie să înceapă cu /storage/, /files/, http://, https:// sau \\\\server\\'
  })
  file_link: string;

  @ApiProperty({
    description: 'Conținutul fișierului în format base64 (opțional)',
    example: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo...',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Conținutul fișierului trebuie să fie un string' })
  file_content?: string;

  @ApiProperty({
    description: 'Data expirării documentului',
    example: '2023-12-31T23:59:59Z',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Data expirării trebuie să fie un string' })
  expire_date?: string;

  @ApiProperty({
    description: 'ID-ul folderului (opțional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'ID-ul folderului trebuie să fie un număr' })
  @Transform(({ value }) => (value != null ? parseInt(value, 10) : undefined))
  folder_id?: number;

  @ApiProperty({
    description: 'Note despre fișier (poate include informații despre folder etc.)',
    example: '|folder:Contract de Închiriere locație| Document încărcat la 15.11.2023',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Notele trebuie să fie un string' })
  @Length(0, 1000, { message: 'Notele trebuie să aibă între 0 și 1000 de caractere' })
  notes?: string;
}
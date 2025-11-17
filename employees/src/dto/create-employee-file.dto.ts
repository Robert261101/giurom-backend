import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Length,
  Matches,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEmployeeFileDto {
  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul angajatului este obligatoriu' })
  @Transform(({ value }) => parseInt(value, 10))
  employee_id: number;

  @ApiProperty({
    description: 'Numele fișierului',
    example: 'CV_Ion_Popescu_2023.pdf',
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
    example: 'CV',
    maxLength: 100,
    enum: ['CV', 'Contract', 'Act_Identitate', 'Diploma', 'Certificat', 'Poza', 'Document_Medical', 'Altele', 'profile_picture'],
  })
  @IsString({ message: 'Tipul fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Tipul fișierului este obligatoriu' })
  @Length(2, 100, { message: 'Tipul fișierului trebuie să aibă între 2 și 100 de caractere' })
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier sau calea de stocare',
    example: '/files/employees/1/cv_ion_popescu.pdf',
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
    description: 'Data expirării documentului (opțional)',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data expirării trebuie să fie în format ISO 8601' })
  expire_date?: string;

  @ApiProperty({
    description: 'Conținutul fișierului în format base64 (opțional)',
    example: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo...',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Conținutul fișierului trebuie să fie un string' })
  file_content?: string;
}
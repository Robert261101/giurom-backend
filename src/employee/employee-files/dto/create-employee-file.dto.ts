import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateEmployeeFileDto {
  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul angajatului este obligatoriu' })
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
    enum: ['CV', 'Contract', 'Act_Identitate', 'Diploma', 'Certificat', 'Poza', 'Document_Medical', 'Altele'],
  })
  @IsString({ message: 'Tipul fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Tipul fișierului este obligatoriu' })
  @Length(2, 100, { message: 'Tipul fișierului trebuie să aibă între 2 și 100 de caractere' })
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier sau calea de stocare',
    example: '/storage/employees/1/cv_ion_popescu.pdf',
    maxLength: 255,
  })
  @IsString({ message: 'Link-ul fișierului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Link-ul fișierului este obligatoriu' })
  @Length(5, 255, { message: 'Link-ul fișierului trebuie să aibă între 5 și 255 de caractere' })
  @Matches(/^(\/files\/|\/storage\/|https?:\/\/|\\\\server\\)/, {
    message: 'Link-ul trebuie să înceapă cu /files/, /storage/, http://, https:// sau \\\\server\\'
  })
  file_link: string;
} 
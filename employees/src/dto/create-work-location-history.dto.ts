import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
} from 'class-validator';

export class CreateWorkLocationHistoryDto {
  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul angajatului este obligatoriu' })
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul locației de lucru trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul locației de lucru este obligatoriu' })
  work_location_id: number;

  @ApiProperty({
    description: 'Descrierea mutării sau schimbării',
    example: 'Transferat de la sediul central la filiala Cluj pentru proiectul de dezvoltare software',
    maxLength: 1000,
  })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Descrierea este obligatorie' })
  @Length(10, 1000, { message: 'Descrierea trebuie să aibă între 10 și 1000 de caractere' })
  description: string;
}
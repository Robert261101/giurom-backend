import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  IsNotEmpty,
  Length,
  IsPositive,
} from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul angajatului este obligatoriu' })
  @IsPositive({ message: 'ID-ul angajatului trebuie să fie pozitiv' })
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul locației de lucru trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul locației de lucru este obligatoriu' })
  @IsPositive({ message: 'ID-ul locației de lucru trebuie să fie pozitiv' })
  work_location_id: number;

  @ApiProperty({
    description: 'ID-ul departamentului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul departamentului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul departamentului este obligatoriu' })
  @IsPositive({ message: 'ID-ul departamentului trebuie să fie pozitiv' })
  department_id: number;

  @ApiProperty({
    description: 'ID-ul poziției în departament',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul poziției trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul poziției este obligatoriu' })
  @IsPositive({ message: 'ID-ul poziției trebuie să fie pozitiv' })
  position_id: number;

  @ApiProperty({
    description: 'Data și ora de început a schimbului',
    example: '2024-01-15T08:00:00Z',
  })
  @IsDateString({}, { message: 'Data de început trebuie să fie o dată validă în format ISO' })
  @IsNotEmpty({ message: 'Data de început este obligatorie' })
  start_datetime: string;

  @ApiProperty({
    description: 'Data și ora de sfârșit a schimbului',
    example: '2024-01-15T16:00:00Z',
  })
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie o dată validă în format ISO' })
  @IsNotEmpty({ message: 'Data de sfârșit este obligatorie' })
  end_datetime: string;

  @ApiProperty({
    description: 'Note despre schimbul de lucru',
    example: 'Schimb de dimineață cu responsabilități speciale',
    required: false,
  })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
}
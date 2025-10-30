import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  Length,
  Min,
} from 'class-validator';

export class CreateCalendarEventDto {
  @ApiProperty({ 
    description: 'Titlul evenimentului', 
    example: 'Ședință echipă',
    maxLength: 100 
  })
  @IsString({ message: 'Titlul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Titlul este obligatoriu' })
  @Length(1, 100, { message: 'Titlul trebuie să aibă între 1 și 100 de caractere' })
  title: string;

  @ApiProperty({ 
    description: 'Categoria evenimentului', 
    example: 'Întâlniri',
    maxLength: 100 
  })
  @IsString({ message: 'Categoria trebuie să fie un string' })
  @IsNotEmpty({ message: 'Categoria este obligatorie' })
  @Length(1, 100, { message: 'Categoria trebuie să aibă între 1 și 100 de caractere' })
  category: string;

  @ApiProperty({ 
    description: 'Data și ora de început', 
    example: '2024-07-25T09:00:00Z' 
  })
  @IsDateString({}, { message: 'Data de început trebuie să fie în format ISO' })
  start_datetime: string;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit', 
    example: '2024-07-25T10:00:00Z' 
  })
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie în format ISO' })
  end_datetime: string;

  @ApiProperty({ 
    description: 'Durata în minute', 
    example: 60,
    minimum: 1 
  })
  @IsNumber({}, { message: 'Durata trebuie să fie un număr' })
  @Min(1, { message: 'Durata trebuie să fie cel puțin 1 minut' })
  duration: number;

  @ApiProperty({ 
    description: 'Descrierea evenimentului', 
    example: 'Discutăm despre progresul proiectelor și planurile pentru săptămâna viitoare',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  description?: string;

  @ApiProperty({ 
    description: 'ID regula de recurență', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'ID-ul regulii de recurență trebuie să fie un număr' })
  @IsPositive({ message: 'ID-ul regulii de recurență trebuie să fie pozitiv' })
  recurrence_id?: number;

  @ApiProperty({ 
    description: 'ID angajat care creează evenimentul', 
    example: 1 
  })
  @IsNumber({}, { message: 'ID-ul creatorului trebuie să fie un număr' })
  @IsPositive({ message: 'ID-ul creatorului trebuie să fie pozitiv' })
  created_by: number;
}



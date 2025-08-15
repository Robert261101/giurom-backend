import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Length } from 'class-validator';

export class CreateWorkLocationDepartmentsDto {
  @ApiProperty({ description: 'Numele departamentului', example: 'Departamentul IT', maxLength: 50 })
  @IsString({ message: 'Numele departamentului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele departamentului este obligatoriu' })
  @Length(2, 50, { message: 'Numele departamentului trebuie să aibă între 2 și 50 de caractere' })
  name: string;

  @ApiProperty({ description: 'Codul departamentului', example: 'IT001', maxLength: 20 })
  @IsString({ message: 'Codul departamentului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Codul departamentului este obligatoriu' })
  @Length(2, 20, { message: 'Codul departamentului trebuie să aibă între 2 și 20 de caractere' })
  code: string;

  @ApiProperty({ description: 'Descrierea departamentului', example: 'Departament responsabil pentru infrastructura IT', required: false })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Descrierea nu poate depăși 1000 de caractere' })
  description?: string;

  @ApiProperty({ description: 'ID-ul locației de lucru', example: 1 })
  @IsNumber({}, { message: 'ID-ul locației trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul locației este obligatoriu' })
  work_location_id: number;
} 
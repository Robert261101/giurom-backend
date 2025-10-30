import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Length } from 'class-validator';

export class CreateWorkLocationDepartmentPositionsDto {
  @ApiProperty({ description: 'Numele poziției', example: 'Dezvoltator Software Senior', maxLength: 50 })
  @IsString({ message: 'Numele poziției trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele poziției este obligatoriu' })
  @Length(2, 50, { message: 'Numele poziției trebuie să aibă între 2 și 50 de caractere' })
  name: string;

  @ApiProperty({ description: 'Codul poziției', example: 'DEV_SR_001', maxLength: 50 })
  @IsString({ message: 'Codul poziției trebuie să fie un string' })
  @IsNotEmpty({ message: 'Codul poziției este obligatoriu' })
  @Length(2, 50, { message: 'Codul poziției trebuie să aibă între 2 și 50 de caractere' })
  code: string;

  @ApiProperty({ description: 'Descrierea poziției', example: 'Responsabil pentru dezvoltarea aplicațiilor web', required: false })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Descrierea nu poate depăși 1000 de caractere' })
  description?: string;

  @ApiProperty({ description: 'ID-ul departamentului', example: 1 })
  @IsNumber({}, { message: 'ID-ul departamentului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul departamentului este obligatoriu' })
  department_id: number;
} 
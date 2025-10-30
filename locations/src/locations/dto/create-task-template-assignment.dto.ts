import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, IsDateString, Length } from 'class-validator';

export class CreateTaskTemplateAssignmentDto {
  @ApiProperty({ description: 'ID-ul locației de lucru', example: 1 })
  @IsNumber({}, { message: 'ID-ul locației trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul locației este obligatoriu' })
  location_id: number;

  @ApiProperty({ description: 'ID-ul template-ului de sarcină', example: 1, default: 1, required: false })
  @IsNumber({}, { message: 'ID-ul template-ului trebuie să fie un număr' })
  @IsOptional()
  template_id?: number = 1;

  @ApiProperty({ description: 'Data când a fost atribuit template-ul la locație', example: '2023-12-15T10:30:00Z', required: false })
  @IsDateString({}, { message: 'Data atribuirii trebuie să fie o dată validă' })
  @IsOptional()
  assigned_at?: string;

  @ApiProperty({ description: 'Indică dacă template-ul este activ pentru această locație', example: true, default: true, required: false })
  @IsBoolean({ message: 'Statusul activ trebuie să fie boolean' })
  @IsOptional()
  active?: boolean = true;

  @ApiProperty({ description: 'Note despre atribuirea template-ului', example: 'Template atribuit pentru echipa de dimineață', required: false })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
} 
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsNumber, IsOptional } from 'class-validator';

export class CreateEmployeeDailyPointsDto {
  @ApiProperty({ description: 'ID-ul angajatului' })
  @IsInt()
  employee_id: number;

  @ApiProperty({ description: 'Data de lucru (YYYY-MM-DD)' })
  @IsDateString()
  work_date: string;

  @ApiProperty({ description: 'Punctajul total pentru ziua respectivă', required: false })
  @IsNumber()
  @IsOptional()
  total_points?: number;
}











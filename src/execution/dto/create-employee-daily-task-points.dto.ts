import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class CreateEmployeeDailyTaskPointsDto {
  @ApiProperty({ description: 'ID-ul punctajului zilnic al angajatului' })
  @IsInt()
  employee_daily_points_id: number;

  @ApiProperty({ description: 'ID-ul execuției task-ului' })
  @IsInt()
  task_execution_id: number;

  @ApiProperty({ description: 'Punctajul acordat pentru acest task' })
  @IsNumber()
  points_awarded: number;
}












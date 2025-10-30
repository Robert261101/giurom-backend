import { IsOptional, IsInt, IsBoolean, IsDateString } from 'class-validator';

export class ExecutionFiltersDto {
  @IsInt()
  @IsOptional()
  task_assignment_id?: number;

  @IsInt()
  @IsOptional()
  employee_id?: number;

  // is_verified_by_manager eliminat - logica se face prin elemente

  @IsDateString()
  @IsOptional()
  started_at_from?: string;

  @IsDateString()
  @IsOptional()
  started_at_to?: string;

  @IsDateString()
  @IsOptional()
  completed_at_from?: string;

  @IsDateString()
  @IsOptional()
  completed_at_to?: string;

  // verification_date eliminat - logica se face prin elemente
} 
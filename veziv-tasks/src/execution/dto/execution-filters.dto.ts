import { IsOptional, IsInt, IsBoolean, IsDateString } from 'class-validator';

export class ExecutionFiltersDto {
  @IsInt()
  @IsOptional()
  task_assignment_id?: number;

  @IsInt()
  @IsOptional()
  employee_id?: number;

  @IsBoolean()
  @IsOptional()
  is_verified_by_manager?: boolean;

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

  @IsDateString()
  @IsOptional()
  verification_date_from?: string;

  @IsDateString()
  @IsOptional()
  verification_date_to?: string;
} 
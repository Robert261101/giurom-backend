import { IsInt, IsNotEmpty, IsString, Min, IsOptional } from 'class-validator';

export class CreateAnswerDto {
  @IsInt()
  @IsNotEmpty()
  task_execution_id: number;

  @IsInt()
  @IsNotEmpty()
  task_element_id: number;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  score_awarded?: number;
} 
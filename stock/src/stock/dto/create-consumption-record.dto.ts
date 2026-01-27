import { IsNumber, IsOptional, IsDateString, IsPositive, Min, IsString } from 'class-validator';

export class CreateConsumptionRecordDto {
  @IsOptional()
  @IsNumber()
  product_id?: number;

  @IsOptional()
  @IsNumber()
  recipe_preparation_id?: number;

  @IsOptional()
  @IsNumber()
  employee_id?: number;

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  location_id: number;

  @IsDateString()
  consumed_at: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  created_at?: string;

  @IsOptional()
  @IsDateString()
  updated_at?: string;
}
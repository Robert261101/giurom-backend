import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
} from 'class-validator';

export class FilterCalendarEventsDto {
  @ApiPropertyOptional({ description: 'Data de început (ISO)' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'Data de sfârșit (ISO)' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Filtrare după event_category.id' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  category_id?: number;

  @ApiPropertyOptional({ description: 'Filtrare după cod categorie' })
  @IsOptional()
  @IsString()
  category_code?: string;

  @ApiPropertyOptional({ description: 'Filtrare după creator (employee_id)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  created_by_employee_id?: number;

  @ApiPropertyOptional({ description: 'Căutare în titlu sau descriere' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrare după locație' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  location_id?: number;

  @ApiPropertyOptional({ enum: ['active', 'cancelled', 'all'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'cancelled', 'all'])
  status?: 'active' | 'cancelled' | 'all';
}

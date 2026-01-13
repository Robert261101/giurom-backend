import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
} from 'class-validator';
import { ShiftChangeStatus } from '../entities/shift-change-request.entity';

export class FilterShiftChangeRequestsDto {
  @ApiProperty({ 
    description: 'Statusul cererii pentru filtrare', 
    enum: ShiftChangeStatus,
    example: ShiftChangeStatus.PENDING,
    required: false 
  })
  @IsOptional()
  @IsEnum(ShiftChangeStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' })
  status?: ShiftChangeStatus;

  @ApiProperty({ 
    description: 'ID angajat care cere schimbul pentru filtrare', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'employee_id trebuie să fie un număr' })
  @IsPositive({ message: 'employee_id trebuie să fie pozitiv' })
  employee_id?: number;

  @ApiProperty({ 
    description: 'ID angajat înlocuitor pentru filtrare', 
    example: 2,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'replacement_id trebuie să fie un număr' })
  @IsPositive({ message: 'replacement_id trebuie să fie pozitiv' })
  replacement_id?: number;

  @ApiProperty({ 
    description: 'Data de început pentru filtrare', 
    example: '2024-08-01T00:00:00Z',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de început trebuie să fie în format ISO' })
  start_date?: string;

  @ApiProperty({ 
    description: 'Data de sfârșit pentru filtrare', 
    example: '2024-08-31T23:59:59Z',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie în format ISO' })
  end_date?: string;

  @ApiProperty({ 
    description: 'ID manager care a aprobat/respins pentru filtrare', 
    example: 3,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'reviewed_by_id trebuie să fie un număr' })
  @IsPositive({ message: 'reviewed_by_id trebuie să fie pozitiv' })
  reviewed_by_id?: number;

  @ApiProperty({ 
    description: 'ID locație de lucru pentru filtrare', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'location_id trebuie să fie un număr' })
  @IsPositive({ message: 'location_id trebuie să fie pozitiv' })
  location_id?: number;
}
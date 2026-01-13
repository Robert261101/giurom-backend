import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
  IsString,
} from 'class-validator';
import { LeaveStatus, DurationUnit } from '../entities/leave-request.entity';

export class FilterLeaveRequestsDto {
  @ApiProperty({ 
    description: 'Statusul cererii pentru filtrare', 
    enum: LeaveStatus,
    example: LeaveStatus.PENDING,
    required: false 
  })
  @IsOptional()
  @IsEnum(LeaveStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' })
  status?: LeaveStatus;

  @ApiProperty({ 
    description: 'ID angajat pentru filtrare', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'employee_id trebuie să fie un număr' })
  @IsPositive({ message: 'employee_id trebuie să fie pozitiv' })
  employee_id?: number;

  @ApiProperty({ 
    description: 'Tipul concediului pentru filtrare', 
    example: 'Concediu de odihnă',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Tipul concediului trebuie să fie un string' })
  leave_type?: string;

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
    example: 2,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'reviewed_by_id trebuie să fie un număr' })
  @IsPositive({ message: 'reviewed_by_id trebuie să fie pozitiv' })
  reviewed_by_id?: number;

  @ApiProperty({ 
    description: 'Unitatea de durată pentru filtrare', 
    enum: DurationUnit,
    example: DurationUnit.DAYS,
    required: false 
  })
  @IsOptional()
  @IsEnum(DurationUnit, { message: 'Unitatea de durată trebuie să fie days sau hours' })
  duration_unit?: DurationUnit;

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
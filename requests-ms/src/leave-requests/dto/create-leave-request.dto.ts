import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
  Length,
} from 'class-validator';
import { DurationUnit } from '../entities/leave-request.entity';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'ID angajat care face cererea', example: 1 })
  @IsNumber({}, { message: 'employee_id trebuie să fie un număr' })
  @IsPositive({ message: 'employee_id trebuie să fie pozitiv' })
  employee_id: number;

  @ApiProperty({ 
    description: 'Tipul concediului', 
    example: 'Concediu de odihnă',
    maxLength: 100 
  })
  @IsString({ message: 'Tipul concediului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Tipul concediului este obligatoriu' })
  @Length(2, 100, { message: 'Tipul concediului trebuie să aibă între 2 și 100 de caractere' })
  leave_type: string;

  @ApiProperty({ 
    description: 'Data și ora de început a concediului', 
    example: '2024-08-01T00:00:00Z' 
  })
  @IsDateString({}, { message: 'Data de început trebuie să fie în format ISO' })
  start_datetime: string;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit a concediului', 
    example: '2024-08-05T23:59:59Z' 
  })
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie în format ISO' })
  end_datetime: string;

  @ApiProperty({ 
    description: 'Comentariul/motivul cererii', 
    example: 'Concediu planificat pentru vacanța de vară',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Comentariul trebuie să fie un string' })
  comment?: string;

  @ApiProperty({ 
    description: 'Unitatea de măsură pentru durată', 
    enum: DurationUnit, 
    example: DurationUnit.DAYS,
    required: false 
  })
  @IsOptional()
  @IsEnum(DurationUnit, { message: 'Unitatea de durată trebuie să fie days sau hours' })
  duration_unit?: DurationUnit;

  @ApiProperty({ 
    description: 'ID locație de lucru asociată cererii', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'location_id trebuie să fie un număr' })
  @IsPositive({ message: 'location_id trebuie să fie pozitiv' })
  location_id?: number;
}
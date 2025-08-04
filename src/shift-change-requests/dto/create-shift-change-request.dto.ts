import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';
import { DurationUnit } from '../entities/shift-change-request.entity';

export class CreateShiftChangeRequestDto {
  @ApiProperty({ description: 'ID angajat care cere schimbul', example: 1 })
  @IsNumber({}, { message: 'employee_id trebuie să fie un număr' })
  @IsPositive({ message: 'employee_id trebuie să fie pozitiv' })
  employee_id: number;

  @ApiProperty({ description: 'ID angajat propus ca înlocuitor', example: 2 })
  @IsNumber({}, { message: 'replacement_id trebuie să fie un număr' })
  @IsPositive({ message: 'replacement_id trebuie să fie pozitiv' })
  replacement_id: number;

  @ApiProperty({ 
    description: 'Data și ora de început a schimbului', 
    example: '2024-08-01T08:00:00Z' 
  })
  @IsDateString({}, { message: 'Data de început trebuie să fie în format ISO' })
  start_datetime: string;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit a schimbului', 
    example: '2024-08-01T16:00:00Z' 
  })
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie în format ISO' })
  end_datetime: string;

  @ApiProperty({ 
    description: 'Comentariul/motivul cererii de schimb', 
    example: 'Am o urgență medicală și nu pot lucra în această tură',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Comentariul trebuie să fie un string' })
  comment?: string;

  @ApiProperty({ 
    description: 'Unitatea de măsură pentru durată', 
    enum: DurationUnit, 
    example: DurationUnit.DAYS 
  })
  @IsEnum(DurationUnit, { message: 'duration_unit trebuie să fie days sau hours' })
  duration_unit: DurationUnit;
}
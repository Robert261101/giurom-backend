import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  Min,
  Matches,
} from 'class-validator';
import { RecurrenceFrequency } from '../entities/recurrence-rule.entity';

export class CreateRecurrenceRuleDto {
  @ApiProperty({ 
    description: 'Frecvența recurenței', 
    enum: RecurrenceFrequency, 
    example: RecurrenceFrequency.WEEKLY 
  })
  @IsEnum(RecurrenceFrequency, { message: 'Frecvența trebuie să fie una din valorile permise' })
  frequency: RecurrenceFrequency;

  @ApiProperty({ 
    description: 'Intervalul de recurență (ex: la fiecare 2 săptămâni)', 
    example: 1,
    minimum: 1 
  })
  @IsNumber({}, { message: 'Intervalul trebuie să fie un număr' })
  @Min(1, { message: 'Intervalul trebuie să fie cel puțin 1' })
  interval: number;

  @ApiProperty({ 
    description: 'Data și ora de început a recurenței', 
    example: '2024-07-25T09:00:00Z' 
  })
  @IsDateString({}, { message: 'Data de început trebuie să fie în format ISO' })
  start_datetime: string;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit a recurenței', 
    example: '2024-12-31T23:59:59Z',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie în format ISO' })
  end_datetime?: string;

  @ApiProperty({ 
    description: 'Zilele și orele recurenței în format JSON (ex: {"mon":"09:00","wed":"14:30","fri":"11:15"})', 
    example: '{"mon":"09:00","wed":"14:30","fri":"11:15"}',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Zilele recurenței trebuie să fie un string JSON valid' })
  recurrence_days?: string;
}
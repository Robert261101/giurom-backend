import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class FilterCalendarEventsDto {
  @ApiProperty({ 
    description: 'Data de început pentru filtrare', 
    example: '2024-07-01T00:00:00Z',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de început trebuie să fie în format ISO' })
  start_date?: string;

  @ApiProperty({ 
    description: 'Data de sfârșit pentru filtrare', 
    example: '2024-07-31T23:59:59Z',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de sfârșit trebuie să fie în format ISO' })
  end_date?: string;

  @ApiProperty({ 
    description: 'Categoria evenimentelor', 
    example: 'Întâlniri',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Categoria trebuie să fie un string' })
  category?: string;

  @ApiProperty({ 
    description: 'ID-ul creatorului evenimentelor', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'ID-ul creatorului trebuie să fie un număr' })
  @IsPositive({ message: 'ID-ul creatorului trebuie să fie pozitiv' })
  created_by?: number;

  @ApiProperty({ 
    description: 'Căutare în titlu sau descriere', 
    example: 'ședință',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Termenul de căutare trebuie să fie un string' })
  search?: string;
}
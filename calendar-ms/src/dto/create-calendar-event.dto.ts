import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  Length,
  IsBoolean,
  IsIn,
  IsArray,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCalendarEventDto {
  @ApiProperty({ description: 'Titlul evenimentului', example: 'Ședință echipă', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  title: string;

  @ApiProperty({ description: 'ID categorie (event_category.id)', example: 6 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  category_id: number;

  @ApiProperty({ description: 'Data și ora de început', example: '2024-07-25T09:00:00Z' })
  @IsDateString()
  start_datetime: string;

  @ApiProperty({ description: 'Data și ora de sfârșit', example: '2024-07-25T10:00:00Z' })
  @IsDateString()
  end_datetime: string;

  @ApiProperty({ description: 'Descriere', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Eveniment pe toată ziua', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  all_day?: boolean;

  @ApiProperty({
    description: 'Eveniment companie întreagă (location_id trebuie lipsă)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_company_wide?: boolean;

  @ApiProperty({ description: 'ID locație (obligatoriu dacă nu e company-wide)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  location_id?: number;

  @ApiProperty({
    description: 'Tip eveniment',
    enum: ['general', 'meeting'],
    required: false,
    default: 'general',
  })
  @IsOptional()
  @IsIn(['general', 'meeting'])
  event_type?: 'general' | 'meeting';

  @ApiProperty({
    description: 'Participanți (doar pentru event_type=meeting)',
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @IsPositive({ each: true })
  participant_employee_ids?: number[];
}

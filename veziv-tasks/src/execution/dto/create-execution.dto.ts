import { IsInt, IsNotEmpty, IsOptional, IsBoolean, IsString, IsDateString, Min, MaxLength, IsArray, ValidateNested, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AssignmentExistsValidator } from '../validators/assignment-exists.validator';
import { ElementsExistInTemplateValidator } from '../validators/elements-exist-in-template.validator';

export class CreateAnswerDto {
  @ApiProperty({
    description: 'ID-ul elementului din template',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  task_element_id: number;

  @ApiProperty({
    description: 'Valoarea răspunsului (text, URL pentru poze, true/false pentru scoring_boolean)',
    example: 'true',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  value?: string;

  @ApiProperty({
    description: 'Scorul acordat pentru elemente de tip scoring_boolean',
    example: 5,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  score_awarded?: number;
}



export class CreateExecutionDto {
  @ApiProperty({
    description: 'ID-ul assignment-ului',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  @Validate(AssignmentExistsValidator)
  task_assignment_id: number;

  @ApiProperty({
    description: 'ID-ul angajatului care execută sarcina',
    example: 5
  })
  @IsInt()
  @IsNotEmpty()
  employee_id: number;

  @ApiProperty({
    description: 'Data și ora de început',
    example: '2024-01-15T09:00:00Z'
  })
  @IsDateString()
  started_at: string;

  @ApiProperty({
    description: 'Data și ora de finalizare',
    example: '2024-01-15T11:30:00Z',
    required: false
  })
  @IsDateString()
  @IsOptional()
  completed_at?: string;

  @ApiProperty({
    description: 'Comentariu despre execuție',
    example: 'Sarcina a fost finalizată cu succes',
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;

  @ApiProperty({
    description: 'Dacă execuția a fost verificată de manager',
    example: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  is_verified_by_manager?: boolean;

  @ApiProperty({
    description: 'Data verificării de către manager',
    example: '2024-01-15T17:00:00Z',
    required: false
  })
  @IsDateString()
  @IsOptional()
  verification_date?: string;

  @ApiProperty({
    description: 'Scorul total al execuției',
    example: 85,
    minimum: 0,
    required: false
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  total_score?: number;

  @ApiProperty({
    description: 'Răspunsurile pentru elementele din template',
    type: [CreateAnswerDto],
    example: [
      {
        task_element_id: 1,
        value: 'true',
        score_awarded: 5
      },
      {
        task_element_id: 2,
        value: 'false',
        score_awarded: 0
      },
      {
        task_element_id: 3,
        value: 'https://example.com/photo1.jpg'
      },
      {
        task_element_id: 4,
        value: 'Observații despre execuție'
      }
    ],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Validate(ElementsExistInTemplateValidator)
  @Type(() => CreateAnswerDto)
  answers?: CreateAnswerDto[];
} 
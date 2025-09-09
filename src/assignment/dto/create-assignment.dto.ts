import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString, Min, Max, MaxLength, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AssignedToType, AssignmentStatus, Priority } from '../entity/task-assignment.entity';
import { TemplateExistsValidator } from '../validators/template-exists.validator';
import { ElementsExistInTemplateValidator } from '../validators/elements-exist-in-template.validator';

export class CreateElementDto {
  @ApiProperty({
    description: 'ID-ul elementului din template',
    example: 1
  })
  @IsNumber()
  task_element_id: number;

  @ApiProperty({
    description: 'Valoarea pentru element (scor pentru scoring_boolean, grup pentru group, valoare pentru recurrence, etc.)',
    example: '8',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  value?: string;

  @ApiProperty({
    description: 'Scorul pentru elemente de tip scoring_boolean',
    example: 5,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score?: number;


}



export class CreateAssignmentDto {
  @ApiProperty({
    description: 'ID-ul template-ului',
    example: 1
  })
  @IsNumber()
  @Validate(TemplateExistsValidator)
  template_id: number;

  @ApiProperty({
    description: 'Tipul de atribuire',
    enum: AssignedToType,
    example: AssignedToType.PERSON
  })
  @IsEnum(AssignedToType)
  assigned_to_type: AssignedToType;

  @ApiProperty({
    description: 'ID-ul persoanei/grupului căruia i se atribuie',
    example: 123,
    required: false
  })
  @IsOptional()
  @IsNumber()
  assigned_to_id?: number;

  @ApiProperty({
    description: 'ID-ul angajatului care creează assignment-ul',
    example: 456
  })
  @IsNumber()
  created_by_employee_id: number;

  @ApiProperty({
    description: 'Scorul total',
    example: 8,
    minimum: 0,
    maximum: 10,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  total_score?: number;

  @ApiProperty({
    description: 'Statusul assignment-ului',
    enum: AssignmentStatus,
    example: AssignmentStatus.ASSIGNED
  })
  @IsEnum(AssignmentStatus)
  status: AssignmentStatus;

  @ApiProperty({
    description: 'Prioritatea',
    enum: Priority,
    example: Priority.MEDIUM
  })
  @IsEnum(Priority)
  priority: Priority;

  @ApiProperty({
    description: 'Data atribuirii',
    example: '2024-01-15T10:00:00Z'
  })
  @IsDateString()
  assigned_at: string;

  @ApiProperty({
    description: 'Data limită',
    example: '2024-01-20T18:00:00Z'
  })
  @IsDateString()
  due_date: string;

  @ApiProperty({
    description: 'Data și ora programată pentru execuție',
    example: '2024-01-18T14:00:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  scheduled_datetime?: string;

  @ApiProperty({
    description: 'Note generale',
    example: 'Assignment pentru curățenia săptămânală',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({
    description: 'Dacă necesită verificarea managerului',
    example: false
  })
  @IsBoolean()
  requires_manager_check: boolean;

  @ApiProperty({
    description: 'Valorile pentru elemente (scoruri pentru scoring_boolean, grupuri pentru group, valori pentru recurrence, etc.)',
    type: [CreateElementDto],
    example: [
      {
        task_element_id: 1,
        value: '8',
        score: 5
      },
      {
        task_element_id: 2,
        value: '9',
        score: 7
      },
      {
        task_element_id: 3,
        value: 'Grup A'
      },
      {
        task_element_id: 4,
        value: 'daily'
      },
      {
        task_element_id: 5,
        value: 'true'
      }
    ],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Validate(ElementsExistInTemplateValidator)
  @Type(() => CreateElementDto)
  elements?: CreateElementDto[];
} 
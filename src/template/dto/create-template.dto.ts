import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsBoolean, IsNumber, Min, MaxLength, IsDateString, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ElementType } from '../entity/task-element.entity';
import { TemplateType } from '../entity/task-template.entity';

export class CreateElementDto {
  @ApiProperty({
    description: 'Tipul elementului',
    enum: ElementType,
    example: ElementType.INPUT
  })
  @IsEnum(ElementType)
  element_type: ElementType;

  @ApiProperty({
    description: 'Eticheta elementului',
    example: 'Numele sarcinii'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;

  @ApiProperty({
    description: 'Numele elementului',
    example: 'task_name'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Text placeholder pentru element',
    example: 'Introduceți numele sarcinii',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeholder?: string;

  @ApiProperty({
    description: 'Dacă elementul este obligatoriu',
    example: true
  })
  @IsBoolean()
  is_required: boolean;

  @ApiProperty({
    description: 'Ordinea de sortare a elementului',
    example: 1
  })
  @IsNumber()
  @Min(0)
  sort_order: number;

  @ApiProperty({
    description: 'Opțiuni pentru elementele select și radio',
    example: ['Opțiunea 1', 'Opțiunea 2', 'Opțiunea 3'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({
    description: 'Opțiuni cu punctaj pentru elementele scoring_boolean',
    example: [
      { name: 'Opțiunea 1', points: 1 },
      { name: 'Opțiunea 2', points: 2 },
      { name: 'Opțiunea 3', points: 3 }
    ],
    required: false
  })
  @IsOptional()
  @IsString()
  scoring_options?: string;

  @ApiProperty({
    description: 'Punctele fixe pentru elementele scoring_simple',
    example: 10,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  simple_score_points?: number;

  @ApiProperty({
    description: 'Data și ora de finalizare pentru element',
    example: '2024-01-15T17:00:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  finish_at?: string;
}

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Numele template-ului',
    example: 'Template pentru sarcinile zilnice'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  template_name: string;

  @ApiProperty({
    description: 'Tipul template-ului (employee sau manager)',
    enum: TemplateType,
    example: TemplateType.EMPLOYEE
  })
  @IsEnum(TemplateType)
  template_type: TemplateType;

  @ApiProperty({
    description: 'ID-ul locației pentru care se creează template-ul',
    example: 1
  })
  @IsNumber()
  @IsPositive()
  locationId: number;

  @ApiProperty({
    description: 'Lista de elemente ale template-ului',
    type: [CreateElementDto],
    example: [
      {
        element_type: ElementType.TASK_NAME,
        label: 'Numele sarcinii',
        name: 'task_name',
        placeholder: 'Introduceți numele sarcinii',
        is_required: true,
        sort_order: 1
      },
      {
        element_type: ElementType.RESPONSIBLE,
        label: 'Persoana responsabilă',
        name: 'responsible',
        placeholder: 'Selectați persoana responsabilă',
        is_required: true,
        sort_order: 2
      },
      {
        element_type: ElementType.PERSON,
        label: 'Persoana implicată',
        name: 'person',
        placeholder: 'Selectați persoana implicată',
        is_required: false,
        sort_order: 3
      },
      {
        element_type: ElementType.WORK_LOCATION,
        label: 'Locația de lucru',
        name: 'work_location',
        placeholder: 'Introduceți locația de lucru',
        is_required: false,
        sort_order: 4
      },
      {
        element_type: ElementType.ESTIMATED_DURATION,
        label: 'Durata estimată (minute)',
        name: 'estimated_duration',
        placeholder: 'Introduceți durata în minute',
        is_required: false,
        sort_order: 5
      },
      {
        element_type: ElementType.VISIBLE_FROM,
        label: 'Vizibil din',
        name: 'visible_from',
        placeholder: 'Selectați data de început',
        is_required: false,
        sort_order: 6
      },
      {
        element_type: ElementType.RECURRENCE,
        label: 'Recurența',
        name: 'recurrence',
        placeholder: 'Selectați tipul de recurență',
        is_required: false,
        sort_order: 7
      },
      {
        element_type: ElementType.SCORING_BOOLEAN,
        label: 'Calitatea lucrării',
        name: 'quality_score',
        placeholder: 'Evaluați calitatea lucrării',
        is_required: false,
        sort_order: 8
      },
      {
        element_type: ElementType.SCORING_BOOLEAN,
        label: 'Respectarea termenelor',
        name: 'deadline_score',
        placeholder: 'Evaluați respectarea termenelor',
        is_required: false,
        sort_order: 9
      },
      {
        element_type: ElementType.SCORING_SIMPLE,
        label: 'Finalizare completă',
        name: 'completion_bonus',
        placeholder: 'Bonus pentru finalizare completă',
        is_required: false,
        sort_order: 10,
        simple_score_points: 5
      },
      {
        element_type: ElementType.ALLOW_POSTPONE,
        label: 'Permite amânarea',
        name: 'allow_postpone',
        placeholder: 'Permite amânarea sarcinii',
        is_required: false,
        sort_order: 11
      },
      {
        element_type: ElementType.PHOTO,
        label: 'Poze de evidență',
        name: 'evidence_photos',
        placeholder: 'Adăugați poze de evidență',
        is_required: false,
        sort_order: 12
      },
      {
        element_type: ElementType.TEXTAREA,
        label: 'Observații',
        name: 'observations',
        placeholder: 'Introduceți observații',
        is_required: false,
        sort_order: 13
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateElementDto)
  elements: CreateElementDto[];
} 
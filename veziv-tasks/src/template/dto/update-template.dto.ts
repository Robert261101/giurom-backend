import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsBoolean, IsNumber, Min, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ElementType } from '../entity/task-element.entity';

export class UpdateElementDto {
  @ApiProperty({
    description: 'ID-ul elementului (pentru actualizare)',
    example: 1,
    required: false
  })
  @IsOptional()
  @IsNumber()
  id?: number;

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

  @ApiProperty({
    description: 'Dacă elementul este vizibil pentru angajați (false = doar pentru manageri)',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  is_visible_for_employee?: boolean;

  @ApiProperty({
    description: 'Pentru elementul allow_reallocation: dacă task-ul permite realocare (opțional)',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  permite_realocare?: boolean;
}

export class UpdateTemplateDto {
  @ApiProperty({
    description: 'Numele template-ului',
    example: 'Template actualizat pentru sarcinile zilnice'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  template_name?: string;


  @ApiProperty({
    description: 'Lista de elemente ale template-ului',
    type: [UpdateElementDto],
    example: [
      {
        id: 1,
        element_type: ElementType.TASK_NAME,
        label: 'Numele sarcinii actualizat',
        name: 'task_name',
        placeholder: 'Introduceți numele sarcinii',
        is_required: true,
        sort_order: 1
      },
      {
        id: 2,
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
        element_type: ElementType.FINALIZED_IN,
        label: 'Finalizat în (ore:minute)',
        name: 'finalized_in',
        placeholder: 'Introduceți durata în format HH:MM',
        is_required: false,
        sort_order: 6
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
        element_type: ElementType.SCORING_SIMPLE,
        label: 'Finalizare completă',
        name: 'completion_bonus',
        placeholder: 'Bonus pentru finalizare completă',
        is_required: false,
        sort_order: 9,
        simple_score_points: 5
      },
      {
        element_type: ElementType.ALLOW_POSTPONE,
        label: 'Permite amânarea',
        name: 'allow_postpone',
        placeholder: 'Permite amânarea sarcinii',
        is_required: false,
        sort_order: 10
      },
      {
        element_type: ElementType.PHOTO,
        label: 'Poze de evidență',
        name: 'evidence_photos',
        placeholder: 'Adăugați poze de evidență',
        is_required: false,
        sort_order: 11
      },
      {
        element_type: ElementType.TEXTAREA,
        label: 'Observații',
        name: 'observations',
        placeholder: 'Introduceți observații',
        is_required: false,
        sort_order: 12
      }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateElementDto)
  elements?: UpdateElementDto[];
} 
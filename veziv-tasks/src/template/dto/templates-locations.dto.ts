import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class CreateTemplatesLocationsDto {
  @ApiProperty({
    description: 'ID-ul template-ului de task',
    example: 1,
  })
  @IsNumber()
  task_templates_id: number;

  @ApiProperty({
    description: 'ID-ul locației',
    example: 2,
  })
  @IsNumber()
  id_location: number;
}

export class UpdateTemplatesLocationsDto {
  @ApiProperty({
    description: 'ID-ul locației',
    example: 2,
    required: false,
  })
  @IsNumber()
  id_location?: number;
}
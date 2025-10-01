import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsBase64 } from 'class-validator';

export class CreateRecipeMediaDto {
  @ApiProperty({
    description: 'ID-ul rețetei',
    example: 1,
  })
  @IsNumber()
  recipe_id: number;

  @ApiProperty({
    description: 'Numele fișierului',
    example: 'recipe_step_1.jpg',
  })
  @IsString()
  file_name: string;

  @ApiProperty({
    description: 'Tipul fișierului',
    example: 'image/jpeg',
  })
  @IsString()
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier',
    example: '/files/recipes/1/recipe_step_1.jpg',
  })
  @IsString()
  file_link: string;

  @ApiProperty({
    description: 'Conținutul fișierului în format base64',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDA...',
    required: false,
  })
  @IsOptional()
  @IsBase64()
  file_content?: string;
}
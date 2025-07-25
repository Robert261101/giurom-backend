import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsNumber, IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class CreateRecipePreparationDto {
  @ApiProperty({ example: 1, description: 'ID-ul rețetei preparate' })
  @IsInt()
  @IsPositive()
  recipe_id: number;

  @ApiProperty({ example: 1, description: 'ID-ul angajatului care a produs rețeta', required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  employee_id?: number;

  @ApiProperty({ example: 250.75, description: 'Cantitatea produsă' })
  @IsNumber({}, { message: 'quantity trebuie să fie număr' })
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: '2025-07-07T09:00:00Z', description: 'Data producerii (ISO)' })
  @IsDateString({}, { message: 'produced_at trebuie să fie dată ISO' })
  produced_at: string;

  @ApiProperty({ example: false, description: 'Este etichetat', required: false })
  @IsOptional()
  @IsBoolean()
  is_labeled?: boolean;
} 
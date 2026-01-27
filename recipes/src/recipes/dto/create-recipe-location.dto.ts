import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecipeLocationDto {
  @ApiProperty({ description: 'ID-ul rețetei' })
  @IsNumber()
  @IsNotEmpty()
  recipe_id: number;

  @ApiProperty({ description: 'ID-ul locației' })
  @IsNumber()
  @IsNotEmpty()
  id_location: number;

  @ApiProperty({
    description: 'Dacă rețeta este consumabilă în această locație',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_consumable?: boolean;
}

import { IsNumber, IsNotEmpty } from 'class-validator';
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
}

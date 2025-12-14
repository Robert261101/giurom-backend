import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive, Length, Min, Max, IsOptional, IsUrl, IsBoolean } from 'class-validator';

export class CreateRecipeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  category_id: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  location_id?: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(8760)
  expiration_hours: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(50000)
  quantity: number;

  @ApiProperty({
    description: 'Link către un videoclip YouTube cu prepararea rețetei',
    example: 'https://www.youtube.com/watch?v=example',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  video_link?: string;

  @ApiProperty({
    description: 'Dacă rețeta este consumabilă (preparatele create pot fi consumate)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_consumable?: boolean;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateRecipeCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;
}



import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateEventCategoryDto {
  @ApiProperty({ description: 'Cod stabil', example: 'work', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'code trebuie să fie lowercase (litere, cifre, underscore)',
  })
  code: string;

  @ApiProperty({ description: 'Nume afișat', example: 'Work', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ description: 'Activ în listări', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

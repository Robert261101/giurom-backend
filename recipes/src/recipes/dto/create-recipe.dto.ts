import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive, Length, Min, Max } from 'class-validator';

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

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(8760)
  expiration_days: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(50000)
  quantity: number;
}



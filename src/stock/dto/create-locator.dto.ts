import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Length, IsNumber, Min } from 'class-validator';

export class CreateLocatorDto {
  @ApiProperty({ description: 'Denumirea locatorului', example: 'Raft A1', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @ApiProperty({ description: 'Locația fizică', example: 'Depozit Central', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  location: string;

  @ApiProperty({ description: 'Furnizor', example: 'Metro', maxLength: 150, required: false })
  @IsString()
  @IsOptional()
  @Length(2, 150)
  supplier?: string;

  @ApiProperty({ description: 'Preț unitar sugerat', example: 12.5, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  unit_price?: number;
} 
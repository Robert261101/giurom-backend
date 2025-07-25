import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Numele produsului', example: 'Făină', maxLength: 150 })
  @IsString({ message: 'Numele produsului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele produsului este obligatoriu' })
  @Length(2, 150, { message: 'Numele produsului trebuie să aibă între 2 și 150 de caractere' })
  name: string;

  @ApiProperty({ description: 'Unitatea de măsură', example: 'kg', maxLength: 50 })
  @IsString({ message: 'Unitatea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Unitatea este obligatorie' })
  @Length(1, 50, { message: 'Unitatea trebuie să aibă între 1 și 50 de caractere' })
  unit: string;

  @ApiProperty({ description: 'Descrierea produsului', example: 'Făină albă de grâu tip 000', required: false })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Nivelul minim de stoc', example: 10.5, required: false })
  @IsNumber({}, { message: 'Nivelul minim de stoc trebuie să fie un număr' })
  @Min(0, { message: 'Nivelul minim de stoc nu poate fi negativ' })
  @IsOptional()
  min_stock_level?: number;

  @ApiProperty({ description: 'Produsul este activ', example: true, required: false })
  @IsBoolean({ message: 'is_active trebuie să fie boolean' })
  @IsOptional()
  is_active?: boolean;
} 
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

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
} 
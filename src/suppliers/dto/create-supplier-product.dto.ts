import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsPositive,
  Length,
  Min,
} from 'class-validator';

export class CreateSupplierProductDto {
  @ApiProperty({ description: 'ID furnizor', example: 1 })
  @IsNumber({}, { message: 'supplier_id trebuie să fie un număr' })
  @IsPositive({ message: 'supplier_id trebuie să fie pozitiv' })
  supplier_id: number;

  @ApiProperty({ description: 'ID produs din nomenclator', example: 1 })
  @IsNumber({}, { message: 'product_id trebuie să fie un număr' })
  @IsPositive({ message: 'product_id trebuie să fie pozitiv' })
  product_id: number;

  @ApiProperty({ description: 'Numele produsului specific furnizorului', example: 'Făină Extra 000 - Ambalaj 25kg' })
  @IsString({ message: 'Numele produsului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Numele produsului este obligatoriu' })
  @Length(2, 200, { message: 'Numele produsului trebuie să aibă între 2 și 200 de caractere' })
  product_name: string;

  @ApiProperty({ description: 'Descrierea produsului specific furnizorului', example: 'Făină de grâu tip 000, ambalaj sac 25kg, marca Alimentara', required: false })
  @IsString({ message: 'Descrierea produsului trebuie să fie un string' })
  @IsOptional()
  product_description?: string;

  @ApiProperty({ description: 'Unitatea de măsură specifică furnizorului', example: 'sac 25kg' })
  @IsString({ message: 'Unitatea de măsură trebuie să fie un string' })
  @IsNotEmpty({ message: 'Unitatea de măsură este obligatorie' })
  @Length(1, 50, { message: 'Unitatea de măsură trebuie să aibă între 1 și 50 de caractere' })
  unit_of_measure: string;

  @ApiProperty({ description: 'Prețul pe unitate', example: 45.50 })
  @IsNumber({}, { message: 'Prețul pe unitate trebuie să fie un număr' })
  @Min(0, { message: 'Prețul pe unitate nu poate fi negativ' })
  price_per_unit: number;

  @ApiProperty({ description: 'Produsul este activ la acest furnizor', example: true, required: false })
  @IsBoolean({ message: 'is_active trebuie să fie boolean' })
  @IsOptional()
  is_active?: boolean;
}
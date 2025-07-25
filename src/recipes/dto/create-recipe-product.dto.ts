import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRecipeProductDto {
  @ApiProperty({
    description: 'ID-ul rețetei',
    example: 1,
  })
  @IsNotEmpty({ message: 'ID-ul rețetei este obligatoriu' })
  @IsNumber({}, { message: 'ID-ul rețetei trebuie să fie un număr' })
  recipe_id: number;

  @ApiProperty({
    description: 'ID-ul produsului',
    example: 1,
  })
  @IsNotEmpty({ message: 'ID-ul produsului este obligatoriu' })
  @IsNumber({}, { message: 'ID-ul produsului trebuie să fie un număr' })
  product_id: number;

  @ApiProperty({
    description: 'Cantitatea în unitatea produsului',
    example: 500,
  })
  @IsNotEmpty({ message: 'Cantitatea este obligatorie' })
  @IsNumber({}, { message: 'Cantitatea trebuie să fie un număr' })
  @Min(0.01, { message: 'Cantitatea trebuie să fie mai mare decât 0' })
  quantity: number;

  @ApiProperty({
    description: 'Note suplimentare despre produs în rețetă',
    example: 'Tăiați cubulețe mici',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Notele trebuie să fie text' })
  notes?: string;
}
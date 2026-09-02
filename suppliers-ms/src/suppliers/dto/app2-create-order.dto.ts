import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class App2CreateOrderItemDto {
  @ApiProperty({ description: 'ID produs intern stoc (stock.products.id)' })
  @IsInt()
  @IsPositive()
  product_id: number;

  @ApiProperty({ description: 'Cantitatea, in unitatea trimisa de App2' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unitatea de masura a cantitatii (kg, l, buc...)' })
  @IsString()
  @MaxLength(50)
  unit: string;

  @ApiProperty({
    required: false,
    description: 'Gestiunea din giurom 2.0 pe care intra produsul (storage_zones.id)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  giurom2_zone_id?: number;
}

/**
 * Comanda pregatita in giurom 2.0 din alertele de stoc minim.
 *
 * Deliberat mai saraca decat `CreateSupplierOrderDto`: App2 nu cunoaste nomenclatorul
 * furnizorului, nici preturile negociate. Trimite ce stie — produsul de stoc si cantitatea —
 * iar rezolvarea randului de nomenclator si a pretului se face aici.
 */
export class App2CreateOrderDto {
  @ApiProperty({
    description:
      'Cheie de idempotenta generata de App2 (`app2:so:<id>`). Aceeasi cheie nu creeaza ' +
      'a doua comanda — reincercarile dupa timeout sunt sigure.',
  })
  @IsString()
  @MaxLength(150)
  target: string;

  @ApiProperty({ description: 'suppliers.id' })
  @IsInt()
  @IsPositive()
  supplier_id: number;

  @ApiProperty({ description: 'companies.id — locatia legata de App2' })
  @IsInt()
  @IsPositive()
  company_id: number;

  @ApiProperty({ description: 'locations.id — locatia legata de App2' })
  @IsInt()
  @IsPositive()
  location_id: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [App2CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => App2CreateOrderItemDto)
  items: App2CreateOrderItemDto[];
}

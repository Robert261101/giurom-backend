import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SupplierIncrementStockItemDto {
  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Cantitatea trebuie să fie un număr valid cu maximum 2 zecimale' },
  )
  @Min(0.01, { message: 'Cantitatea trebuie să fie mai mare decât 0' })
  @Max(99999999.99, { message: 'Cantitatea depășește limita maximă permisă' })
  quantity: number;
}

export class SupplierIncrementStockDto {
  @ApiProperty({ type: [SupplierIncrementStockItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selectează cel puțin un produs' })
  @ArrayMaxSize(100, { message: 'Maximum 100 de produse per request' })
  @ValidateNested({ each: true })
  @Type(() => SupplierIncrementStockItemDto)
  items: SupplierIncrementStockItemDto[];
}

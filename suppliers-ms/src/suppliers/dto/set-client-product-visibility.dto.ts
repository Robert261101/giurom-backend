import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsInt, IsPositive } from 'class-validator';

export class SetClientProductVisibilityDto {
  @ApiProperty({
    description:
      'IDs supplier_products ascunse pentru compania client autentificată. Lipsă sau listă goală = toate vizibile.',
    type: [Number],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  hidden_supplier_product_ids: number[];
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class CreateSupplierLocationDto {
  @ApiProperty({
    description: 'ID-ul furnizorului',
    example: 1,
  })
  @IsNumber()
  supplier_id: number;

  @ApiProperty({
    description: 'ID-ul locației',
    example: 2,
  })
  @IsNumber()
  id_location: number;
}

export class UpdateSupplierLocationDto {
  @ApiProperty({
    description: 'ID-ul locației',
    example: 2,
    required: false,
  })
  @IsNumber()
  id_location?: number;
}
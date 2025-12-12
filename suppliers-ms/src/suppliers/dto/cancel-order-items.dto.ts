import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CancelOrderItemDto {
  @ApiProperty({ description: 'ID-ul item-ului din comandă (supplier_order_item_id)' })
  @IsNumber()
  itemId: number;

  @ApiProperty({ description: 'Cantitatea de anulat (returned_quantity) - maxim cât mai rămâne de recepționat' })
  @IsNumber()
  returnedQuantity: number;

  @ApiProperty({ description: 'Motivul anulării (opțional)', required: false })
  @IsString()
  @IsOptional()
  returnReason?: string;
}

export class CancelOrderItemsDto {
  @ApiProperty({ description: 'ID-ul comenzii' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ 
    description: 'Lista de item-uri de anulat',
    type: [CancelOrderItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancelOrderItemDto)
  items: CancelOrderItemDto[];
}


import { IsNumber, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CancelOrderItemDto {
  @ApiProperty({ description: 'ID-ul item-ului din comandă (supplier_order_item_id)' })
  @IsNumber()
  itemId: number;

  @ApiProperty({ description: 'Cantitatea de anulat (returned_quantity) - maxim cât mai rămâne de recepționat' })
  @IsNumber()
  returnedQuantity: number;

  @ApiProperty({ description: 'Motivul anulării (opțional)', required: false })
  @IsString()
  @IsOptional()
  returnReason?: string;
}

export class CancelOrderItemsDto {
  @ApiProperty({ description: 'ID-ul comenzii' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ 
    description: 'Lista de item-uri de anulat',
    type: [CancelOrderItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancelOrderItemDto)
  items: CancelOrderItemDto[];
}

















import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, ValidateNested, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PartialReceptionItemDto {
  @ApiProperty({ description: 'ID-ul item-ului din comandă' })
  @IsNumber()
  itemId: number;

  @ApiProperty({ description: 'Cantitatea recepționată' })
  @IsNumber()
  @Min(0)
  receivedQuantity: number;

  @ApiProperty({ description: 'Cantitatea returnată (opțional)', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  returnedQuantity?: number;

  @ApiProperty({ description: 'Motivul returnării (opțional)', required: false })
  @IsString()
  @IsOptional()
  returnReason?: string;
}

export class PartialReceptionDto {
  @ApiProperty({ description: 'ID-ul comenzii' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ 
    description: 'Lista de item-uri recepționate',
    type: [PartialReceptionItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartialReceptionItemDto)
  items: PartialReceptionItemDto[];
}



















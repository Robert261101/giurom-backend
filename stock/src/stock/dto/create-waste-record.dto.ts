import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, ValidateIf, IsString } from 'class-validator';

export class CreateWasteRecordDto {
  @ApiProperty({ description: 'ID of the product that was wasted (required if recipe_preparation_id is not provided)', required: false })
  @ValidateIf((o) => !o.recipe_preparation_id)
  @IsNumber()
  @IsOptional()
  product_id?: number;

  @ApiProperty({ description: 'Location ID reference (no FK)', required: false })
  @IsNumber()
  @IsOptional()
  location_id?: number;

  @ApiProperty({ description: 'ID of the recipe preparation (if waste occurred when throwing a preparation)', required: false })
  @IsNumber()
  @IsOptional()
  recipe_preparation_id?: number;

  @ApiProperty({ description: 'Quantity of product wasted' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Reason for waste', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
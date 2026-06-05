import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  IsPositive,
} from "class-validator";

export class CreateProductAtLocationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  unit: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  sku?: string | null;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_stock_level?: number | null;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  is_consumable?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photo?: string | null;

  @ApiProperty({ description: "Depozit / locație stoc" })
  @IsNumber()
  @IsPositive()
  location_id: number;
}

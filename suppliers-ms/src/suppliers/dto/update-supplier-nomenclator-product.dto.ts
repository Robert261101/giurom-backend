import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  Length,
  IsOptional,
  IsBoolean,
} from "class-validator";

/** Actualizare produs din nomenclatorul depozitului furnizorului. */
export class UpdateSupplierNomenclatorProductDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(2, 150)
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  unit?: string;

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
  @IsBoolean()
  @IsOptional()
  is_consumable?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photo?: string | null;
}

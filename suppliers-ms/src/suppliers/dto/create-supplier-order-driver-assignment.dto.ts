import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, IsOptional, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateSupplierOrderDriverAssignmentDto {
  @ApiProperty()
  @IsNumber()
  driver_id: number;

  @ApiProperty()
  @IsString()
  scheduled_at: string;

  @ApiProperty({ description: "Route stop priority for this driver on the delivery date (1 = highest)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  delivery_priority: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

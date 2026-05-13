import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, IsOptional } from "class-validator";

export class CreateSupplierOrderDriverAssignmentDto {
  @ApiProperty()
  @IsNumber()
  driver_id: number;

  @ApiProperty()
  @IsString()
  scheduled_at: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

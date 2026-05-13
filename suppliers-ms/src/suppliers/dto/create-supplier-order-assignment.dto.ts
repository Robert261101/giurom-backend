import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsString, IsOptional } from 'class-validator';

export class CreateSupplierOrderAssignmentDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  employee_id: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

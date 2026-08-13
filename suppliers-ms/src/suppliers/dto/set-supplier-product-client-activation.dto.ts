import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetSupplierProductClientActivationDto {
  @ApiProperty({ description: 'Produs activ pentru clientul selectat' })
  @IsBoolean()
  is_active: boolean;
}

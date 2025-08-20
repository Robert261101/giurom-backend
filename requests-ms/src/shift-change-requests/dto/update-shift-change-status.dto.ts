import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
} from 'class-validator';
import { ShiftChangeStatus } from '../entities/shift-change-request.entity';

export class UpdateShiftChangeStatusDto {
  @ApiProperty({ 
    description: 'Noul status al cererii', 
    enum: ShiftChangeStatus, 
    example: ShiftChangeStatus.APPROVED 
  })
  @IsEnum(ShiftChangeStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' })
  @IsNotEmpty({ message: 'Statusul este obligatoriu' })
  status: ShiftChangeStatus;

  @ApiProperty({ 
    description: 'ID manager care aprobă/respinge cererea', 
    example: 3 
  })
  @IsNumber({}, { message: 'reviewed_by_id trebuie să fie un număr' })
  @IsPositive({ message: 'reviewed_by_id trebuie să fie pozitiv' })
  reviewed_by_id: number;

  @ApiProperty({ 
    description: 'Comentariu despre decizia luată', 
    example: 'Cererea a fost aprobată, înlocuitorul este disponibil',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Comentariul trebuie să fie un string' })
  review_comment?: string;
}
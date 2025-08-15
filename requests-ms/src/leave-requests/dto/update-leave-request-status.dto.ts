import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
} from 'class-validator';
import { LeaveStatus } from '../entities/leave-request.entity';

export class UpdateLeaveRequestStatusDto {
  @ApiProperty({ 
    description: 'Noul status al cererii', 
    enum: LeaveStatus, 
    example: LeaveStatus.APPROVED 
  })
  @IsEnum(LeaveStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' })
  @IsNotEmpty({ message: 'Statusul este obligatoriu' })
  status: LeaveStatus;

  @ApiProperty({ 
    description: 'ID manager care aprobă/respinge cererea', 
    example: 2 
  })
  @IsNumber({}, { message: 'reviewed_by_id trebuie să fie un număr' })
  @IsPositive({ message: 'reviewed_by_id trebuie să fie pozitiv' })
  reviewed_by_id: number;

  @ApiProperty({ 
    description: 'Comentariu despre decizia luată', 
    example: 'Cererea a fost aprobată conform planificării echipei',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Comentariul trebuie să fie un string' })
  review_comment?: string;
}
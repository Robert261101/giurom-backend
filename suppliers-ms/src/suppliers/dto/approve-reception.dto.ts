import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, IsOptional, IsString } from 'class-validator';

export class ApproveReceptionDto {
  @ApiProperty({ description: 'ID-ul comenzii' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ 
    description: 'Lista de ID-uri ale recepțiilor de aprobat',
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  receptionIds: number[];
}

export class RejectReceptionDto {
  @ApiProperty({ description: 'ID-ul comenzii' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ 
    description: 'Lista de ID-uri ale recepțiilor de respins',
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  receptionIds: number[];

  @ApiProperty({ 
    description: 'Motivul respingerii (opțional)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  reason?: string;
}



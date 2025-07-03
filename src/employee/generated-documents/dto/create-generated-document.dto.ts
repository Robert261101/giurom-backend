import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
  IsDateString,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreateGeneratedDocumentDto {
  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul angajatului este obligatoriu' })
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul documentului template sau referință',
    example: 101,
  })
  @IsNumber({}, { message: 'ID-ul documentului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul documentului este obligatoriu' })
  doc_id: number;

  @ApiProperty({
    description: 'Statusul documentului',
    example: 'Generated',
    enum: ['Generated', 'Signed', 'Expired', 'Cancelled', 'Draft'],
    default: 'Generated',
  })
  @IsString({ message: 'Statusul trebuie să fie un string' })
  @IsNotEmpty({ message: 'Statusul este obligatoriu' })
  @IsIn(['Generated', 'Signed', 'Expired', 'Cancelled', 'Draft'], {
    message: 'Statusul trebuie să fie unul din: Generated, Signed, Expired, Cancelled, Draft'
  })
  status: string = 'Generated';

  @ApiProperty({
    description: 'Data semnării documentului',
    example: '2023-12-15T10:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data semnării trebuie să fie în format ISO' })
  signed_at?: Date;

  @ApiProperty({
    description: 'Data expirării documentului',
    example: '2024-12-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data expirării trebuie să fie în format ISO' })
  expired_date?: Date;
} 
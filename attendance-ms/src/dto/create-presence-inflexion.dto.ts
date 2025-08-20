import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  IsNotEmpty,
  Length,
  IsPositive,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { InflexionType } from '../entities/presence-inflexion.entity';

export class CreatePresenceInflexionDto {
  @ApiProperty({
    description: 'ID-ul prezenței',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul prezenței trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul prezenței este obligatoriu' })
  @IsPositive({ message: 'ID-ul prezenței trebuie să fie pozitiv' })
  presence_id: number;

  @ApiProperty({
    description: 'Timestamp-ul punctului de inflexiune',
    example: '2024-01-15T12:00:00Z',
  })
  @IsDateString({}, { message: 'Timestamp-ul trebuie să fie o dată validă în format ISO' })
  @IsNotEmpty({ message: 'Timestamp-ul este obligatoriu' })
  timestamp: string;

  @ApiProperty({
    description: 'Tipul punctului de inflexiune',
    enum: InflexionType,
    example: InflexionType.EXIT,
  })
  @IsEnum(InflexionType, { message: 'Tipul trebuie să fie unul dintre: exit, entry' })
  @IsNotEmpty({ message: 'Tipul este obligatoriu' })
  type: InflexionType;

  @ApiProperty({
    description: 'Latitudinea GPS la punctul de inflexiune',
    example: 44.4268,
    required: false,
  })
  @IsNumber({}, { message: 'Latitudinea GPS trebuie să fie un număr' })
  @IsOptional()
  @Min(-90, { message: 'Latitudinea trebuie să fie între -90 și 90 de grade' })
  @Max(90, { message: 'Latitudinea trebuie să fie între -90 și 90 de grade' })
  gps_lat?: number;

  @ApiProperty({
    description: 'Longitudinea GPS la punctul de inflexiune',
    example: 26.1025,
    required: false,
  })
  @IsNumber({}, { message: 'Longitudinea GPS trebuie să fie un număr' })
  @IsOptional()
  @Min(-180, { message: 'Longitudinea trebuie să fie între -180 și 180 de grade' })
  @Max(180, { message: 'Longitudinea trebuie să fie între -180 și 180 de grade' })
  gps_lng?: number;

  @ApiProperty({
    description: 'Descrierea locației la punctul de inflexiune',
    example: 'Ieșire pentru masa de prânz',
    required: false,
  })
  @IsString({ message: 'Descrierea locației trebuie să fie un string' })
  @IsOptional()
  @Length(0, 500, { message: 'Descrierea locației nu poate depăși 500 de caractere' })
  location_description?: string;

  @ApiProperty({
    description: 'Note despre punctul de inflexiune',
    example: 'Ieșire aprobată de manager pentru întâlnire de lucru',
    required: false,
  })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
}
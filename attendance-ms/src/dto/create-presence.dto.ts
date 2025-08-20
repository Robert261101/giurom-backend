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
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { PresenceStatus } from '../entities/presence.entity';

export class CreatePresenceDto {
  @ApiProperty({
    description: 'ID-ul schimbului de lucru',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul schimbului trebuie să fie un număr' })
  @IsNotEmpty({ message: 'ID-ul schimbului este obligatoriu' })
  @IsPositive({ message: 'ID-ul schimbului trebuie să fie pozitiv' })
  shift_id: number;

  @ApiProperty({
    description: 'Data pentru care se înregistrează prezența',
    example: '2024-01-15',
  })
  @IsDateString({}, { message: 'Data trebuie să fie o dată validă în format ISO (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Data este obligatorie' })
  date: string;

  @ApiProperty({
    description: 'Statusul prezenței angajatului',
    enum: PresenceStatus,
    example: PresenceStatus.PRESENT_FULL,
  })
  @IsEnum(PresenceStatus, { message: 'Statusul trebuie să fie unul dintre: present_full, present_partial, absent' })
  @IsNotEmpty({ message: 'Statusul este obligatoriu' })
  status: PresenceStatus;

  @ApiProperty({
    description: 'Ora de check-in',
    example: '2024-01-15T08:00:00Z',
    required: false,
  })
  @IsDateString({}, { message: 'Ora de check-in trebuie să fie o dată validă în format ISO' })
  @IsOptional()
  check_in?: string;

  @ApiProperty({
    description: 'Ora de check-out',
    example: '2024-01-15T16:00:00Z',
    required: false,
  })
  @IsDateString({}, { message: 'Ora de check-out trebuie să fie o dată validă în format ISO' })
  @IsOptional()
  check_out?: string;

  @ApiProperty({
    description: 'Totalul orelor lucrate',
    example: 8.5,
    required: false,
  })
  @IsNumber({}, { message: 'Totalul orelor trebuie să fie un număr' })
  @IsOptional()
  @Min(0, { message: 'Totalul orelor nu poate fi negativ' })
  @Max(24, { message: 'Totalul orelor nu poate depăși 24' })
  total_hours?: number;

  @ApiProperty({
    description: 'Flag GPS pentru ieșirea din zona permisă',
    example: false,
    required: false,
  })
  @IsBoolean({ message: 'Flag-ul GPS trebuie să fie true sau false' })
  @IsOptional()
  gps_exit_flag?: boolean;

  @ApiProperty({
    description: 'Note despre prezența angajatului',
    example: 'A ieșit mai devreme din motive medicale',
    required: false,
  })
  @IsString({ message: 'Notele trebuie să fie un string' })
  @IsOptional()
  @Length(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' })
  notes?: string;
}
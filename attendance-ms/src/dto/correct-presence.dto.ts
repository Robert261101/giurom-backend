import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum PresenceCorrectionAction {
  UPDATE_ENTRY = 'update_entry',
  UPDATE_EXIT = 'update_exit',
  ADD_MISSING_EXIT = 'add_missing_exit',
  ADD_INTERVAL = 'add_interval',
  DELETE_INTERVAL = 'delete_interval',
}

export class CorrectPresenceDto {
  @ApiProperty({ description: 'Motiv obligatoriu pentru corecție' })
  @IsString()
  @MinLength(3)
  correction_reason: string;

  @ApiProperty({ enum: PresenceCorrectionAction })
  @IsEnum(PresenceCorrectionAction)
  action: PresenceCorrectionAction;

  @ApiProperty({ required: false, description: 'ID inflexion intrare/ieșire de actualizat' })
  @ValidateIf(
    (o) =>
      o.action === PresenceCorrectionAction.UPDATE_ENTRY ||
      o.action === PresenceCorrectionAction.UPDATE_EXIT,
  )
  @IsInt()
  @IsPositive()
  inflexion_id?: number;

  @ApiProperty({ required: false, description: 'Timestamp nou (intrare/ieșire)' })
  @ValidateIf(
    (o) =>
      o.action === PresenceCorrectionAction.UPDATE_ENTRY ||
      o.action === PresenceCorrectionAction.UPDATE_EXIT ||
      o.action === PresenceCorrectionAction.ADD_MISSING_EXIT,
  )
  @IsISO8601()
  timestamp?: string;

  @ApiProperty({ required: false, description: 'Intrare pentru pereche nouă' })
  @ValidateIf((o) => o.action === PresenceCorrectionAction.ADD_INTERVAL)
  @IsISO8601()
  entry_at?: string;

  @ApiProperty({ required: false, description: 'Ieșire pentru pereche nouă' })
  @ValidateIf((o) => o.action === PresenceCorrectionAction.ADD_INTERVAL)
  @IsISO8601()
  exit_at?: string;

  @ApiProperty({ required: false, description: 'ID inflexion intrare de șters' })
  @ValidateIf((o) => o.action === PresenceCorrectionAction.DELETE_INTERVAL)
  @IsInt()
  @IsPositive()
  entry_inflexion_id?: number;

  @ApiProperty({ required: false, description: 'ID inflexion ieșire de șters' })
  @ValidateIf((o) => o.action === PresenceCorrectionAction.DELETE_INTERVAL)
  @IsInt()
  @IsPositive()
  exit_inflexion_id?: number;
}

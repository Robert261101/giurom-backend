import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsObject,
  IsUrl,
} from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Tipul notificării', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Titlul notificării', example: 'Label va expira' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Descrierea notificării', example: 'Label-ul pentru produsul X va expira în 2 ore' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'ID-ul utilizatorului destinatar', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  user_id?: number;

  @ApiProperty({ description: 'ID-ul entității asociate', example: 123, required: false })
  @IsOptional()
  @IsNumber()
  entity_id?: number;

  @ApiProperty({ description: 'Tipul entității asociate', example: 'product', required: false })
  @IsOptional()
  @IsString()
  entity_type?: string;

  @ApiProperty({ description: 'URL către care să navigheze utilizatorul', example: '/stoc/123', required: false })
  @IsOptional()
  @IsString()
  target_url?: string;

  @ApiProperty({ description: 'Metadata suplimentară', required: false })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiProperty({ description: 'Data expirării (pentru notificări de expirare)', required: false })
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiProperty({ description: 'Prioritatea notificării', example: 'high', required: false })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';
}
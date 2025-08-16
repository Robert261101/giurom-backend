import { IsInt, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '../entity/notification.entity';

export class CreateNotificationDto {
  @IsInt()
  referenceId: number;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  payload?: any;
} 
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  LABEL_EXPIRING = 'label_expiring',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  DOCUMENT_UPLOADED = 'document_uploaded',
  EMPLOYEE_CREATED = 'employee_created',
  SUPPLIER_CREATED = 'supplier_created',
  STOCK_LOW = 'stock_low',
  LOCATION_ALERT = 'location_alert',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

@Entity('notifications')
export class Notification {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Tipul notificării', enum: NotificationType })
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ description: 'Titlul notificării', example: 'Label va expira' })
  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  title: string;

  @ApiProperty({ description: 'Descrierea notificării', example: 'Label-ul pentru produsul X va expira în 2 ore' })
  @Column({ type: 'text', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description: string;

  @ApiProperty({ description: 'ID-ul utilizatorului destinatar', example: 1 })
  @Column({ nullable: true })
  user_id?: number;

  @ApiProperty({ description: 'Statusul notificării', enum: NotificationStatus })
  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  @ApiProperty({ description: 'ID-ul entității asociate', example: 123 })
  @Column({ nullable: true })
  entity_id?: number;

  @ApiProperty({ description: 'Tipul entității asociate', example: 'product' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type?: string;

  @ApiProperty({ description: 'URL către care să navigheze utilizatorul', example: '/stoc/123' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  target_url?: string;

  @ApiProperty({ description: 'Metadata suplimentară în format JSON' })
  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @ApiProperty({ description: 'Data expirării (pentru notificări de expirare)' })
  @Column({ type: 'datetime', nullable: true })
  expires_at?: Date;

  @ApiProperty({ description: 'Prioritatea notificării', example: 'high' })
  @Column({ type: 'enum', enum: ['low', 'medium', 'high'], default: 'medium' })
  priority: 'low' | 'medium' | 'high';

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
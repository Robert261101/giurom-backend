import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationType {
  CONTRACT_INCOMPLETE = 'contract_incomplete',
  MISSING_SELLER = 'missing_seller',
  MISSING_BUYER = 'missing_buyer',
  MISSING_PRODUCT = 'missing_product',
  MISSING_DELIVERY = 'missing_delivery',
  MISSING_COMMISSION = 'missing_commission',
  MISSING_DRAFT = 'missing_draft',
  CONTRACT_EXPIRING = 'contract_expiring',
  MISSING_SIGNATURE = 'missing_signature',
  MISSING_WARRANTY = 'missing_warranty',
  MISSING_DOCUMENTS = 'missing_documents',
  UNDELIVERED = 'undelivered',
  INVOICE_OVERDUE = 'invoice_overdue',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  referenceId: number; // ID-ul contractului sau facturii

  @Column({ length: 50 })
  resource: string; // serviciul sursă al notificării, ex: 'contract', 'invoice'

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'json', nullable: true })
  payload?: any;

  @Column({ default: false })
  read: boolean;

  @Column({ default: false })
  resolved: boolean; // dacă notificarea a fost rezolvată

  @CreateDateColumn()
  createdAt: Date;
} 
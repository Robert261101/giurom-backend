import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('subscription_invoices')
@Index('idx_subscription_invoices_company', ['company_id'])
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  company_id: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  invoice_number: string | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  period_start: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  period_end: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  issued_at: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'RON' })
  currency: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  download_url: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updated_at: Date;
}

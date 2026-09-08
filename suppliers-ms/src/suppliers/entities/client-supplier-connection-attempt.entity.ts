import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('client_supplier_connection_attempts')
@Index('IDX_client_supplier_connection_attempts_locked_until', ['locked_until'])
export class ClientSupplierConnectionAttempt {
  @PrimaryColumn({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int', default: 0 })
  failed_count: number;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  locked_until: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  last_failed_at: Date | null;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updated_at: Date;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;
}

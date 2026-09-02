import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Supplier } from './supplier.entity';

@Entity('client_manual_supplier_state')
@Index('UQ_client_manual_supplier_state_client_supplier', [
  'client_company_id',
  'supplier_id',
], {
  unique: true,
})
@Index('IDX_client_manual_supplier_state_client', ['client_company_id'])
@Index('IDX_client_manual_supplier_state_supplier', ['supplier_id'])
export class ClientManualSupplierState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int' })
  supplier_id: number;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  quota_status: string;

  /**
   * Per-client operational active flag for Manual suppliers.
   * Independent of suppliers.is_active (global).
   */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Supplier } from './supplier.entity';

/**
 * Company-level link: client company ↔ account supplier.
 * Source of truth for association via connection code (not Manual suppliers).
 */
@Entity('client_supplier_links')
@Index('UQ_client_supplier_links_client_supplier', ['client_company_id', 'supplier_id'], {
  unique: true,
})
@Index('IDX_client_supplier_links_client_company_id', ['client_company_id'])
@Index('IDX_client_supplier_links_supplier_id', ['supplier_id'])
export class ClientSupplierLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int' })
  supplier_id: number;

  @Column({ type: 'int', nullable: true })
  linked_by_user_id: number | null;

  /**
   * Client-specific usage of this Cont association.
   * Independent of suppliers.is_active (global). Inactive for one client
   * does not deactivate the supplier for other clients.
   */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Subscription quota state for this client ↔ Cont supplier link. */
  @Column({ type: 'varchar', length: 16, default: 'active' })
  quota_status: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * GIU-12: preferință client — produs ascuns pentru o companie client.
 * Lipsă rând = vizibil (implicit, compatibilitate comenzi vechi).
 */
@Entity('supplier_product_client_visibility')
@Index('uq_client_supplier_product_visibility', [
  'client_company_id',
  'supplier_product_id',
], {
  unique: true,
})
export class SupplierProductClientVisibility {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int' })
  supplier_product_id: number;

  /** false = ascuns pentru client; se persistă doar produsele ascunse. */
  @Column({ type: 'boolean', default: false })
  is_visible: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

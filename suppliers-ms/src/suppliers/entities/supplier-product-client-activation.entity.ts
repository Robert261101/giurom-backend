import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Activare explicită produs furnizor per companie client (tenant furnizor).
 * Lipsă rând pentru un produs = folosește supplier_products.is_active (legacy).
 * După primul rând pentru un produs, activarea devine per-client.
 */
@Entity('supplier_product_client_activation')
@Index('uq_client_supplier_product_activation', [
  'client_company_id',
  'supplier_product_id',
], {
  unique: true,
})
export class SupplierProductClientActivation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  supplier_company_id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int' })
  supplier_product_id: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

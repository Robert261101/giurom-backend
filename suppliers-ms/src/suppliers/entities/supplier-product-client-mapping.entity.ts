import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('supplier_product_client_mappings')
@Index('uq_client_location_supplier_product', [
  'client_company_id',
  'client_location_id',
  'supplier_product_id',
], {
  unique: true,
})
@Index('idx_mapping_client_stock_product', [
  'client_company_id',
  'client_stock_product_id',
])
@Index('idx_mapping_client_company_location', [
  'client_company_id',
  'client_location_id',
])
export class SupplierProductClientMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  /**
   * Locația clientului pentru care se aplică maparea.
   */
  @Column({ type: 'int' })
  client_location_id: number;

  @Column({ type: 'int' })
  supplier_product_id: number;

  /** stock.products.id — nomenclatorul companiei client */
  @Column({ type: 'int' })
  client_stock_product_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('supplier_product_client_prices')
@Index('uq_client_supplier_product_price', ['client_company_id', 'supplier_product_id'], {
  unique: true,
})
export class SupplierProductClientPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  supplier_company_id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int' })
  supplier_product_id: number;

  /** Preț preferențial pe aceeași bază ca supplier_products.price_per_unit. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  preferred_price: number;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

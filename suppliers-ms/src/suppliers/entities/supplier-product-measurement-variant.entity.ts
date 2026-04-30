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
import { SupplierProduct } from './supplier-product.entity';

@Entity('supplier_product_measurement_variants')
@Index(['supplier_product_id'])
export class SupplierProductMeasurementVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_product_id: number;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  variant_label: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  net_quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  gross_quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  measurement_unit: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => SupplierProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_product_id' })
  supplierProduct: SupplierProduct;
}

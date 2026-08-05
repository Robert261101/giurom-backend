import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SupplierOrder } from './supplier-order.entity';

@Entity('supplier_order_items')
export class SupplierOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column()
  product_id: number;

  /** Nomenclatură furnizor (supplier_products.id); null pe comenzi vechi */
  @Column({ type: 'int', nullable: true })
  supplier_product_id?: number | null;

  @Column({ nullable: true })
  variant_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_unit: number;

  /** Snapshot bază preț la creare. NULL pe comenzi vechi = 1. */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  price_base_quantity?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  price_base_unit?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  received_quantity: number;

  @Column({ type: 'datetime', nullable: true })
  reception_date?: Date;

  @Column({ nullable: true })
  reception_user_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  returned_quantity: number;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  availability_status: string;

  @Column({ type: 'tinyint', default: 1 })
  is_original: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  return_reason?: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => SupplierOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SupplierOrder;
}



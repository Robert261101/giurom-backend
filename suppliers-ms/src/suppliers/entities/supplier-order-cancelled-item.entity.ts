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
import { SupplierOrder } from './supplier-order.entity';
import { SupplierOrderItem } from './supplier-order-item.entity';

@Entity('supplier_order_cancelled_items')
export class SupplierOrderCancelledItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  order_id: number;

  @Index()
  @Column()
  supplier_order_item_id: number;

  @Index()
  @Column()
  product_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_unit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  received_quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  returned_quantity: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  return_reason?: string;

  @Column({ type: 'datetime' })
  reception_date: Date;

  @Column()
  reception_user_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => SupplierOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SupplierOrder;

  @ManyToOne(() => SupplierOrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_order_item_id' })
  orderItem: SupplierOrderItem;
}


  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SupplierOrder } from './supplier-order.entity';
import { SupplierOrderItem } from './supplier-order-item.entity';

@Entity('supplier_order_cancelled_items')
export class SupplierOrderCancelledItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  order_id: number;

  @Index()
  @Column()
  supplier_order_item_id: number;

  @Index()
  @Column()
  product_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_unit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  received_quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  returned_quantity: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  return_reason?: string;

  @Column({ type: 'datetime' })
  reception_date: Date;

  @Column()
  reception_user_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => SupplierOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SupplierOrder;

  @ManyToOne(() => SupplierOrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_order_item_id' })
  orderItem: SupplierOrderItem;
}

















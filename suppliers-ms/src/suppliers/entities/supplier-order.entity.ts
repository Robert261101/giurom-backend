import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { SupplierOrderItem } from './supplier-order-item.entity';
import { SupplierOrderDocument } from './supplier-order-document.entity';
import { SupplierOrderItemReception } from './supplier-order-item-reception.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
}

@Entity('supplier_orders')
export class SupplierOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_id: number;

  @Column({ type: 'datetime' })
  order_date: Date;

  @Column({ type: 'datetime' })
  delivery_date: Date;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  total_amount_with_vat: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes?: string;

  @Column()
  created_by_user_id: number;

  @Column({ type: 'int', nullable: true })
  supplier_location_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  cancelled_at?: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => SupplierOrderItem, (item) => item.order, { cascade: true })
  items: SupplierOrderItem[];

  @OneToMany(() => SupplierOrderDocument, (document) => document.order)
  documents: SupplierOrderDocument[];

  @OneToMany(() => SupplierOrderItemReception, (reception) => reception.order)
  receptions: SupplierOrderItemReception[];
}




  @OneToMany(() => SupplierOrderItemReception, (reception) => reception.order)
  receptions: SupplierOrderItemReception[];
}



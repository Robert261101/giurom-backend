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
import { SupplierOrderAssignment } from './supplier-order-assignment.entity';
import { SupplierOrderDriverAssignment } from './supplier-order-driver-assignment.entity';
import { SupplierOrderWarehouseReview } from './supplier-order-warehouse-review.entity';
import { SupplierOrderItemChange } from './supplier-order-item-change.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  MAGAZIONER = 'magazioner',
  SOFER = 'sofer',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
  RECEIVED = 'received',
  RETURNED_TO_SUPPLIER = 'returned_to_supplier',
  RETURNED_FROM_SUPPLIER = 'returned_from_supplier',
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

  @Column({ type: 'int', nullable: true })
  company_id: number;

  @Column({ type: 'int', nullable: true })
  location_id: number;

  company_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  location_county?: string | null;
  location_postal_code?: string | null;
  location_country?: string | null;
  supplier_name?: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  cancelled_at?: Date;

  /** Calculated (not persisted): supplier has authenticatable furnizor login. */
  has_supplier_account?: boolean;

  @ManyToOne(() => Supplier, (supplier) => supplier.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => SupplierOrderItem, (item) => item.order, { cascade: true })
  items: SupplierOrderItem[];

  @OneToMany(() => SupplierOrderDocument, (document) => document.order)
  documents: SupplierOrderDocument[];

  @OneToMany(() => SupplierOrderItemReception, (reception) => reception.order)
  receptions: SupplierOrderItemReception[];

  @OneToMany(() => SupplierOrderAssignment, (assignment) => assignment.order)
  assignments: SupplierOrderAssignment[];

  @OneToMany(
    () => SupplierOrderDriverAssignment,
    (driverAssignment) => driverAssignment.order,
  )
  driverAssignments: SupplierOrderDriverAssignment[];

  @OneToMany(
    () => SupplierOrderWarehouseReview,
    (review) => review.order,
  )
  warehouseReviews: SupplierOrderWarehouseReview[];

  @OneToMany(
    () => SupplierOrderItemChange,
    (change) => change.order,
  )
  itemChanges: SupplierOrderItemChange[];
}



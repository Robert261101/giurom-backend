import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupplierOrder } from './supplier-order.entity';

export enum ReceptionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('supplier_order_item_receptions')
export class SupplierOrderItemReception {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  supplier_order_id: number;

  @ManyToOne(() => SupplierOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_order_id' })
  order: SupplierOrder;

  @Index()
  @Column()
  supplier_order_item_id: number;

  @Index()
  @Column()
  product_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  received_delta: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  returned_delta: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  reason?: string;

  @Column({ type: 'int', nullable: true })
  user_id?: number;

  @Column({ type: 'int', nullable: true })
  location_id?: number;

  @Column({ type: 'datetime' })
  occurred_at: Date;

  @Column({ type: 'int', nullable: true })
  stock_item_id?: number;

  @Column({ 
    type: 'enum', 
    enum: ReceptionStatus, 
    default: ReceptionStatus.PENDING 
  })
  @Index()
  status: ReceptionStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}






}






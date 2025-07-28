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
import { ApiProperty } from '@nestjs/swagger';
import { Supplier } from './supplier.entity';
import { SupplierOrderItem } from './supplier-order-item.entity';
import { SupplierOrderDocument } from './supplier-order-document.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
}

@Entity('supplier_orders')
export class SupplierOrder {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID furnizor', example: 1 })
  @Column()
  supplier_id: number;

  @ApiProperty({ description: 'Data comenzii', example: '2024-07-25T10:00:00Z' })
  @Column({ type: 'datetime' })
  order_date: Date;

  @ApiProperty({ description: 'Data estimată de livrare', example: '2024-07-30T10:00:00Z' })
  @Column({ type: 'datetime' })
  delivery_date: Date;

  @ApiProperty({ description: 'Statusul comenzii', enum: OrderStatus, example: OrderStatus.DRAFT })
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @ApiProperty({ description: 'Suma totală a comenzii', example: 1250.75 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_amount: number;

  @ApiProperty({ description: 'Note despre comandă', example: 'Livrare urgentă', required: false })
  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes?: string;

  @ApiProperty({ description: 'ID utilizator care a creat comanda', example: 1 })
  @Column()
  created_by_user_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Supplier, (supplier) => supplier.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => SupplierOrderItem, (item) => item.order, { cascade: true })
  items: SupplierOrderItem[];

  @OneToMany(() => SupplierOrderDocument, (document) => document.order)
  documents: SupplierOrderDocument[];
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { SupplierOrder } from './supplier-order.entity';
import { Product } from '../../stock/entities/product.entity';

@Entity('supplier_order_items')
export class SupplierOrderItem {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID comandă', example: 1 })
  @Column()
  order_id: number;

  @ApiProperty({ description: 'ID produs', example: 1 })
  @Column()
  product_id: number;

  @ApiProperty({ description: 'Cantitatea comandată', example: 50.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @ApiProperty({ description: 'Prețul pe unitate', example: 25.75 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_unit: number;

  @ApiProperty({ description: 'Subtotalul (quantity * price_per_unit)', example: 1300.88 })
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => SupplierOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SupplierOrder;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
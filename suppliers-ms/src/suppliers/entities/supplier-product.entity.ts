import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Supplier } from './supplier.entity';

@Entity('supplier_products')
export class SupplierProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_id: number;

  @Column()
  product_id: number;

  @Column({ type: 'varchar', length: 200, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  product_name: string;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  product_description?: string;

  @Column({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  unit_of_measure: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_unit: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0 })
  vat: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  final_price: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @BeforeInsert()
  @BeforeUpdate()
  calculateFinalPrice() {
    const price = Number(this.price_per_unit) || 0;
    const vatPercent = Number(this.vat) || 0;
    const vatAmount = (price * vatPercent) / 100;
    this.final_price = price + vatAmount;
  }
}



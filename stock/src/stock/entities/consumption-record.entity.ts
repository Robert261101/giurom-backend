import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('consumption_records')
export class ConsumptionRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  product_id?: number;

  @Column({ nullable: true })
  recipe_preparation_id?: number;

  @Column({ nullable: true })
  employee_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ nullable: true })
  location_id?: number;

  @Column({ type: 'datetime' })
  consumed_at: Date;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  reason?: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  // recipe_preparation_id and employee_id are reference fields only - no FK relationships
  // Data retrieved via HTTP calls to respective microservices when needed
}
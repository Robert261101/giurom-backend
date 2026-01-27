import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('waste_records')
export class WasteRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  product_id?: number;

  @Column({ nullable: true })
  location_id?: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  recipe_preparation_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  reason: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relationship with Product (within same microservice)
  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  // No foreign key relationships to other microservices
  // Location and recipe references are handled via API calls when needed
}
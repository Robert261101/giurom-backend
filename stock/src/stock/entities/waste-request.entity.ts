import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

export type WasteRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('waste_requests')
export class WasteRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  product_id?: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  recipe_preparation_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  quantity?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  reason?: string | null;

  @Column({ type: 'json', nullable: true })
  photos?: string[];

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: WasteRequestStatus;

  @Index()
  @Column({ type: 'int', nullable: true })
  created_by?: number;

  @Column({ type: 'int', nullable: true })
  location_id?: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relation to product
  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;
}

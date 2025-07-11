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
import { Product } from '../../stock/entities/product.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';

@Entity('waste_records')
export class WasteRecord {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID produs (opțional)', example: 1, required: false })
  @Column({ nullable: true })
  product_id?: number;

  @ApiProperty({ description: 'ID rețetă (opțional)', example: 2, required: false })
  @Column({ nullable: true })
  recipe_id?: number;

  @ApiProperty({ description: 'Cantitate pierdută', example: 3.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @ApiProperty({ description: 'Unitate', example: 'kg', maxLength: 20 })
  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @ApiProperty({ description: 'Motiv pierdere', example: 'Expirat', required: false })
  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @ManyToOne(() => Recipe, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recipe_id' })
  recipe?: Recipe;
} 
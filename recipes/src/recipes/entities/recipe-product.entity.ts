import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Recipe } from './recipe.entity';
// Import the class instead of the entity
import { ProductRef } from '../../external/product-ref.entity';

@Entity('recipe_products')
export class RecipeProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  recipe_id: number;

  @Column()
  product_id: number;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  quantity: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Recipe, (recipe) => recipe.recipe_products, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  // Reference to product from stock service - stored as plain object since we removed the entity mapping
  product?: ProductRef | null;
}
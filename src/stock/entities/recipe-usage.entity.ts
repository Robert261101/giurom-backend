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
import { Product } from './product.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';

@Entity('recipe_usages')
export class RecipeUsage {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID produs', example: 1 })
  @Column()
  product_id: number;

  @ApiProperty({ description: 'ID rețetă', example: 1 })
  @Column()
  recipe_id: number;

  @ApiProperty({ description: 'Procent din produs față de rețetă', example: 12.5 })
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @ApiProperty({ description: 'Cantitate folosită', example: 150.75 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity_used: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Product, (product) => product.recipe_usages, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Recipe, (recipe) => recipe.recipe_products, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;
} 
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
import { Recipe } from './recipe.entity';
import { Product } from '../../stock/entities/product.entity';

@Entity('recipe_products')
export class RecipeProduct {
  @ApiProperty({
    description: 'ID-ul unic al asocierii rețetă-produs',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul rețetei',
    example: 1,
  })
  @Column()
  recipe_id: number;

  @ApiProperty({
    description: 'ID-ul produsului',
    example: 1,
  })
  @Column()
  product_id: number;

  @ApiProperty({
    description: 'Cantitatea în unitatea produsului',
    example: 500,
  })
  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Note suplimentare despre produs în rețetă',
    example: 'Tăiați cubulețe mici',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  notes: string;

  @ApiProperty({
    description: 'Data când a fost creată asocierea',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data când a fost actualizată asocierea',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Rețeta care folosește produsul',
    type: () => Recipe,
  })
  @ManyToOne(() => Recipe, (recipe) => recipe.recipe_products, { 
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @ApiProperty({
    description: 'Produsul folosit în rețetă',
    type: () => Product,
  })
  @ManyToOne(() => Product, (product) => product.recipe_products, { 
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
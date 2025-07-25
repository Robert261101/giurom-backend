import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RecipeCategory } from './recipe-category.entity';
import { RecipeProduct } from './recipe-product.entity';

@Entity('recipes')
export class Recipe {
  @ApiProperty({
    description: 'ID-ul unic al rețetei',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Numele rețetei',
    example: 'Pizza Margherita',
    maxLength: 150,
  })
  @Column({
    type: 'varchar',
    length: 150,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  name: string;

  @ApiProperty({
    description: 'Descrierea și instrucțiunile de preparare',
    example: '1. Întinde aluatul...\n2. Adaugă sosul de roșii...\n3. Presară mozzarella...',
  })
  @Column({
    type: 'text',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  description: string;

  @ApiProperty({
    description: 'ID-ul categoriei din care face parte rețeta',
    example: 1,
  })
  @Column()
  category_id: number;

  @ApiProperty({
    description: 'Data când a fost creată rețeta',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data când a fost actualizată rețeta',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ApiProperty({
    description: 'Număr de ore până la expirare după preparare',
    example: 48,
  })
  @Column({ type: 'int' })
  expiration_days: number;

  @ApiProperty({
    description: 'Cantitatea finală a rețetei în grame',
    example: 1500,
  })
  @Column({ type: 'int' })
  quantity: number;

  // Relații
  @ApiProperty({
    description: 'Categoria din care face parte rețeta',
    type: () => RecipeCategory,
  })
  @ManyToOne(() => RecipeCategory, (category) => category.recipes, { 
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'category_id' })
  category: RecipeCategory;

  @ApiProperty({
    description: 'Produsele folosite în rețetă',
    type: () => [RecipeProduct],
  })
  @OneToMany(() => RecipeProduct, (recipeProduct) => recipeProduct.recipe, {
    cascade: true,
    eager: false,
  })
  recipe_products: RecipeProduct[];
} 
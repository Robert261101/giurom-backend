import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity('recipe_recipes')
export class RecipeRecipe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  recipe_id: number; // Rețeta care conține ingredientul

  @Column()
  ingredient_recipe_id: number; // Rețeta folosită ca ingredient

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  quantity: number; // Cantitatea de rețetă necesară (în unități de rețetă)

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Recipe, (recipe) => recipe.recipe_recipes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'ingredient_recipe_id' })
  ingredient_recipe: Recipe;
}






















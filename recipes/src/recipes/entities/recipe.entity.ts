import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RecipeCategory } from './recipe-category.entity';
import { RecipeProduct } from './recipe-product.entity';
import { RecipePreparation } from './recipe-preparation.entity';
import { RecipeMedia } from './recipe-media.entity';
import { RecipeRecipe } from './recipe-recipe.entity';
import { RecipeLocation } from './recipe-location.entity';

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  name: string;

  @Column({ type: 'text', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description: string;

  @Column()
  category_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @Column({ type: 'int', default: 24 })
  expiration_hours: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  /**
   * Unitatea de măsură pentru cantitatea rețetei (ex: g, ml, buc).
   * Importantă când o rețetă este folosită ca ingredient în altă rețetă (recipe_recipes).
   */
  @Column({ type: 'varchar', length: 20, default: 'g', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  unit: string;

  // Add video_link field
  @Column({ type: 'varchar', length: 500, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  video_link: string | null;

  // NOTĂ: `is_consumable` este per-locație (în `recipe_locations.is_consumable`),
  // nu global pe rețetă. Coloana veche din `recipes` poate fi eliminată din DB.

  @ManyToOne(() => RecipeCategory, (category) => category.recipes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: RecipeCategory;

  @OneToMany(() => RecipeProduct, (rp) => rp.recipe, { cascade: true, eager: false })
  recipe_products: RecipeProduct[];

  @OneToMany(() => RecipeRecipe, (rr) => rr.recipe, { cascade: true, eager: false })
  recipe_recipes: RecipeRecipe[];

  @OneToMany(() => RecipePreparation, (rp) => rp.recipe, { cascade: true, eager: false })
  recipe_preparations: RecipePreparation[];

  @OneToMany(() => RecipeMedia, (media) => media.recipe, { cascade: true, eager: false })
  recipeMedia: RecipeMedia[];

  @OneToMany(() => RecipeLocation, (rl) => rl.recipe, { cascade: true, eager: false })
  recipeLocations: RecipeLocation[];
}
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

  @Column({ type: 'int', nullable: true })
  location_id?: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @Column({ type: 'int', default: 24 })
  expiration_hours: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  // Add video_link field
  @Column({ type: 'varchar', length: 500, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  video_link: string | null;

  @Column({ type: 'boolean', default: false })
  is_consumable: boolean;

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
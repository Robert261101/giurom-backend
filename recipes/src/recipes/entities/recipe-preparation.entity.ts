import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Recipe } from './recipe.entity';
import { RecipeLabel } from './recipe-label.entity';

@Entity('recipe_preparations')
export class RecipePreparation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  recipe_id: number;

  @Column({ nullable: true })
  employee_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'datetime' })
  produced_at: Date;

  @Column({ type: 'boolean', default: false })
  is_labeled: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Recipe, (recipe) => recipe.id, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @OneToMany(() => RecipeLabel, (label) => label.preparation)
  labels: RecipeLabel[];
}



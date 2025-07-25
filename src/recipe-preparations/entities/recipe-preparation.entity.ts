import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from '../../recipes/entities/recipe.entity';
import { Employee } from '../../employee/entity/employee.entity';
import { RecipeLabel } from '../../recipe-labels/entities/recipe-label.entity';

@Entity('recipe_preparations')
export class RecipePreparation {
  @ApiProperty({ description: 'Identificator unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID-ul rețetei preparate', example: 3 })
  @Column()
  recipe_id: number;

  @ApiProperty({ description: 'ID-ul angajatului care a produs', example: 12, required: false })
  @Column({ nullable: true })
  produced_by: number | null;

  @ApiProperty({ description: 'Cantitatea totală produsă', example: 250.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @ApiProperty({ description: 'Data producerii', example: '2025-07-07T09:00:00Z' })
  @Column({ type: 'datetime' })
  produced_at: Date;

  @ApiProperty({ description: 'Etichetat sau nu', example: true })
  @Column({ type: 'bool', default: false })
  is_labeled: boolean;

  // Relation to label
  // Will be defined in RecipeLabel entity as OneToOne back-reference

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // relations
  @ManyToOne(() => Recipe, (recipe) => recipe.id, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @ManyToOne(() => Employee, (employee) => employee.id, { onDelete: 'SET NULL', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'produced_by' })
  employee: Employee | null;

  @OneToOne(() => RecipeLabel, (label) => label.preparation)
  label: RecipeLabel;
} 
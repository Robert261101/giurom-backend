import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RecipeIngredient } from './recipe-ingredient.entity';

@Entity('ingredients')
export class Ingredient {
  @ApiProperty({
    description: 'ID-ul unic al ingredientului',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Numele ingredientului',
    example: 'Cartofi',
    maxLength: 100,
  })
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  name: string;

  @ApiProperty({
    description: 'Descrierea ingredientului',
    example: 'Cartofi proaspeți, ideal pentru gătit',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  description: string;

  @ApiProperty({
    description: 'Unitatea de măsură',
    example: 'grame',
    maxLength: 50,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  unit: string;

  @ApiProperty({
    description: 'Categoría ingredientului',
    example: 'Legume',
    maxLength: 50,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  category: string;

  @ApiProperty({
    description: 'Data când a fost creat ingredientul',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data când a fost actualizat ingredientul',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Rețetele care folosesc acest ingredient',
    type: () => [RecipeIngredient],
  })
  @OneToMany(() => RecipeIngredient, (recipeIngredient) => recipeIngredient.ingredient, {
    cascade: true,
    eager: false,
  })
  recipe_ingredients: RecipeIngredient[];
} 
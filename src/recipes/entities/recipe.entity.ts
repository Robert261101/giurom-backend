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
import { RecipeIngredient } from './recipe-ingredient.entity';

export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

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
    example: 'Supă de legume cu cartofi',
    maxLength: 200,
  })
  @Column({
    type: 'varchar',
    length: 200,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  name: string;

  @ApiProperty({
    description: 'Descrierea rețetei',
    example: 'O supă delicioasă și nutritivă, perfectă pentru zilele reci',
  })
  @Column({
    type: 'text',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  description: string;

  @ApiProperty({
    description: 'Instrucțiunile de preparare',
    example: '1. Spălați legumele...\n2. Tăiați cartofii...\n3. Puneți totul la fiert...',
  })
  @Column({
    type: 'text',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  instructions: string;

  @ApiProperty({
    description: 'ID-ul categoriei din care face parte rețeta',
    example: 1,
  })
  @Column()
  category_id: number;

  @ApiProperty({
    description: 'Timpul de preparare în minute',
    example: 30,
  })
  @Column()
  preparation_time: number;

  @ApiProperty({
    description: 'Timpul de gătire în minute',
    example: 45,
  })
  @Column()
  cooking_time: number;

  @ApiProperty({
    description: 'Numărul de porții',
    example: 4,
  })
  @Column()
  servings: number;

  @ApiProperty({
    description: 'Nivelul de dificultate',
    enum: DifficultyLevel,
    example: DifficultyLevel.EASY,
  })
  @Column({
    type: 'enum',
    enum: DifficultyLevel,
    default: DifficultyLevel.EASY,
  })
  difficulty: DifficultyLevel;

  @ApiProperty({
    description: 'Număr de zile până la expirare după preparare',
    example: 7,
    required: false,
  })
  @Column({ type: 'int', nullable: true })
  expiration_days?: number;

  @ApiProperty({
    description: 'Calorii per porție',
    example: 250,
    required: false,
  })
  @Column({
    type: 'int',
    nullable: true,
  })
  calories_per_serving: number;

  @ApiProperty({
    description: 'Link către imagini cu rețeta',
    example: 'https://example.com/recipe-image.jpg',
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  image_url: string;

  @ApiProperty({
    description: 'Autorul rețetei',
    example: 'Chef Maria',
    maxLength: 100,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  author: string;

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
    description: 'Ingredientele folosite în rețetă',
    type: () => [RecipeIngredient],
  })
  @OneToMany(() => RecipeIngredient, (recipeIngredient) => recipeIngredient.recipe, {
    cascade: true,
    eager: false,
  })
  recipe_ingredients: RecipeIngredient[];
} 
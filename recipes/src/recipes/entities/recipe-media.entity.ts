import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from './recipe.entity';

@Entity('recipe_media')
export class RecipeMedia {
  @ApiProperty({
    description: 'ID-ul unic al fișierului media',
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
    description: 'Numele fișierului',
    example: 'recipe_step_1.jpg',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_name: string;

  @ApiProperty({
    description: 'Tipul fișierului',
    example: 'image/jpeg',
    maxLength: 100,
  })
  @Column({
    type: 'varchar',
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier',
    example: '/files/recipes/1/recipe_step_1.jpg',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_link: string;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Rețeta asociată cu acest fișier media',
    type: () => Recipe,
  })
  @ManyToOne(() => Recipe, recipe => recipe.recipeMedia)
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;
}
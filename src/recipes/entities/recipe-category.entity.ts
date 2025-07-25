import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from './recipe.entity';

@Entity('recipe_categories')
export class RecipeCategory {
  @ApiProperty({
    description: 'ID-ul unic al categoriei de rețete',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Numele categoriei de rețete',
    example: 'Supe și Ciorbe',
    maxLength: 150,
  })
  @Column({
    type: 'varchar',
    length: 150,
    unique: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  name: string;

  @ApiProperty({
    description: 'Data când a fost creată categoria',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data când a fost actualizată categoria',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Rețetele din această categorie',
    type: () => [Recipe],
  })
  @OneToMany(() => Recipe, (recipe) => recipe.category, {
    cascade: true,
    eager: false,
  })
  recipes: Recipe[];
} 
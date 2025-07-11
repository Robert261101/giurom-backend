import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RecipePreparation } from '../../recipe-preparations/entities/recipe-preparation.entity';

@Entity('recipe_labels')
export class RecipeLabel {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID preparation', example: 10 })
  @Column()
  recipe_preparation_id: number;

  @ApiProperty({ description: 'Cod etichetă', example: 'LBL-1234...' })
  @Column({ type: 'varchar', length: 100, unique: true })
  label_code: string;

  @ApiProperty({ description: 'Data generării', example: '2024-07-07T10:00:00Z' })
  @CreateDateColumn({ type: 'datetime' })
  generated_at: Date;

  @ApiProperty({ description: 'Calea fișier PDF', example: '/labels/LBL-1234.pdf' })
  @Column({ type: 'text' })
  label_file_path: string;

  @OneToOne(() => RecipePreparation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_preparation_id' })
  preparation: RecipePreparation;
} 
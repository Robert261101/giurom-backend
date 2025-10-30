import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { RecipePreparation } from './recipe-preparation.entity';

@Entity('recipe_labels')
export class RecipeLabel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  recipe_preparation_id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  label_code: string;

  @Column({ type: 'varchar', length: 500 })
  label_file_path: string;

  @CreateDateColumn({ type: 'datetime' })
  generated_at: Date;

  @ManyToOne(() => RecipePreparation, (prep) => prep.labels, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'recipe_preparation_id' })
  preparation: RecipePreparation;
}
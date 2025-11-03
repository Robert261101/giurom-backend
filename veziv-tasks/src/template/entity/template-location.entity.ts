import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TaskTemplate } from './task-template.entity';

@Entity('templates_locations')
export class TemplateLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_templates_id' })
  taskTemplateId: number;

  @Column({ name: 'id_location' })
  idLocation: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TaskTemplate)
  @JoinColumn({ name: 'task_templates_id' })
  template: TaskTemplate;
}
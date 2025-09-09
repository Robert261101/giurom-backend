import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TaskTemplate } from './task-template.entity';

@Entity('Templates_Locations')
export class TemplateLocation {
  @ApiProperty({
    description: 'ID-ul unic al relației',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul template-ului de task',
    example: 1,
  })
  @Column({ name: 'task_templates_id' })
  task_templates_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @Column({ name: 'id_location' })
  id_location: number;

  @ApiProperty({
    description: 'Data creării relației',
    example: '2023-12-01T10:00:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Template-ul de task asociat',
    type: () => TaskTemplate,
  })
  @ManyToOne(() => TaskTemplate, (template) => template.locations, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'task_templates_id' })
  template: TaskTemplate;
}




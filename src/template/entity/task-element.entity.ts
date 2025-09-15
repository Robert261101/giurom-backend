import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TaskTemplate } from './task-template.entity';

export enum ElementType {
  INPUT = 'input',
  TEXTAREA = 'textarea',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  SELECT = 'select',
  DATE = 'date',
  LABEL = 'label',
  NUMBER = 'number',
  TASK_NAME = 'task_name',
  RESPONSIBLE = 'responsible',
  PERSON = 'person',
  GROUP = 'group',
  WORK_LOCATION = 'work_location',
  ESTIMATED_DURATION = 'estimated_duration',
  VISIBLE_FROM = 'visible_from',
  RECURRENCE = 'recurrence',
  SCORING_BOOLEAN = 'scoring_boolean',
  SCORING_SIMPLE = 'scoring_simple',
  ALLOW_POSTPONE = 'allow_postpone',
  PHOTO = 'photo',
  FINISH_AT = 'finish_at',
  SCHEDULED_DATETIME = 'scheduled_datetime'
}

@Entity('Task_Elements')
export class TaskElement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id', type: 'int' })
  template_id: number;

  @ManyToOne(() => TaskTemplate, template => template.elements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: TaskTemplate;

  @Column({
    type: 'enum',
    enum: ElementType
  })
  element_type: ElementType;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  placeholder: string;

  @Column({ type: 'boolean', default: false })
  is_required: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'json', nullable: true })
  scoring_options: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  simple_score_points: number;

  @Column({ type: 'json', nullable: true })
  options: string[];

  @Column({ type: 'datetime', nullable: true })
  finish_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
} 
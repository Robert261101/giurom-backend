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
  FINALIZED_IN = 'finalized_in',
  VISIBLE_FROM = 'visible_from',
  RECURRENCE = 'recurrence',
  SCORING_BOOLEAN = 'scoring_boolean',
  SCORING_SIMPLE = 'scoring_simple',
  ALLOW_POSTPONE = 'allow_postpone',
  PHOTO = 'photo',
  FINISH_AT = 'finish_at',
  SCHEDULED_DATETIME = 'scheduled_datetime',
  EMPLOYEE_VISIBILITY = 'employee_visibility',
  REQUIRES_MANAGER_CHECK = 'requires_manager_check',
  
  // Elemente pentru fastfood
  QUALITY_CHECK = 'quality_check',
  TEMPERATURE_CHECK = 'temperature_check',
  PRESENTATION_CHECK = 'presentation_check',
  PREP_TIME = 'prep_time',
  SERVICE_TIME = 'service_time',
  DELIVERY_TIME = 'delivery_time',
  CLEANING_CHECK = 'cleaning_check',
  EQUIPMENT_CHECK = 'equipment_check',
  HYGIENE_CHECK = 'hygiene_check',
  CASH_REGISTER_CHECK = 'cash_register_check',
  INVENTORY_CHECK = 'inventory_check',
  WASTE_CHECK = 'waste_check',
  CUSTOMER_SERVICE = 'customer_service',
  ORDER_ACCURACY = 'order_accuracy',
  UPSELLING_CHECK = 'upselling_check',
  SALES_TARGET = 'sales_target',
  EFFICIENCY_CHECK = 'efficiency_check',
  TEAMWORK_CHECK = 'teamwork_check'
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

  @Column({ type: 'boolean', default: true })
  is_visible_for_employee: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
} 
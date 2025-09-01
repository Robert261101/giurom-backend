import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TaskTemplate } from '../../template/entity/task-template.entity';
import { TaskAssignmentElement } from './task-assignment-element.entity';

export enum AssignedToType {
  PERSON = 'person',
  GROUP = 'group'
}

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

@Entity('Task_Assignment')
export class TaskAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id', type: 'int' })
  template_id: number;

  @ManyToOne(() => TaskTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: TaskTemplate;

  @Column({
    type: 'enum',
    enum: AssignedToType
  })
  assigned_to_type: AssignedToType;

  @Column({ type: 'int', nullable: true })
  assigned_to_id: number;

  @Column({ name: 'created_by_employee_id', type: 'int' })
  created_by_employee_id: number;

  @Column({ type: 'int', default: 0 })
  total_score: number;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ASSIGNED
  })
  status: AssignmentStatus;

  @Column({
    type: 'enum',
    enum: Priority
  })
  priority: Priority;

  @Column({ type: 'datetime' })
  assigned_at: Date;

  @Column({ type: 'datetime' })
  due_date: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  requires_manager_check: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TaskAssignmentElement, element => element.task_assignment)
  elements: TaskAssignmentElement[];
} 
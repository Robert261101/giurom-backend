import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TaskTemplate } from '../../template/entity/task-template.entity';
import { TaskAssignmentElement } from './task-assignment-element.entity';

// Logica de grup se face prin department_group_id + assignment_mode

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  SCHEDULED = 'scheduled',
  DEACTIVATED = 'deactivated',
  WAITING_RESPONSE = 'waiting_response',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AssignmentMode {
  FIRST_COME_FIRST_SERVED = 'first_come_first_served', // Un singur task pentru grup, primul care acceptă devine proprietar
  EVERYONE_GETS_IT = 'everyone_gets_it', // Toți din grup primesc taskul individual (pentru grupuri)
  INDIVIDUAL = 'individual', // Task individual atribuit unei singure persoane
}

@Entity('Task_Assignment')
@Index(['location_id']) // Index pentru filtrare după locație
@Index(['assigned_at']) // Index pentru filtrare după dată
@Index(['scheduled_datetime']) // Index pentru filtrare după dată programată
@Index(['status']) // Index pentru filtrare după status
@Index(['assigned_to_id']) // Index pentru filtrare după angajat
@Index(['location_id', 'status']) // Index compus pentru filtrare după locație + status
@Index(['location_id', 'assigned_at']) // Index compus pentru filtrare după locație + dată
@Index(['location_id', 'scheduled_datetime']) // Index compus pentru filtrare după locație + dată programată
@Index(['assigned_at', 'status']) // Index compus pentru filtrare după dată + status
@Index(['location_id', 'assigned_at', 'status']) // Index compus pentru query-uri complexe
@Index(['is_visible_for_employee']) // Index pentru filtrare după vizibilitate
export class TaskAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id', type: 'int' })
  template_id: number;

  @ManyToOne(() => TaskTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: TaskTemplate;

  @Column({ type: 'int', nullable: true })
  assigned_to_id: number;

  @Column({ name: 'created_by_employee_id', type: 'int' })
  created_by_employee_id: number;

  @Column({ type: 'int', nullable: true })
  location_id: number;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ASSIGNED,
  })
  status: AssignmentStatus;

  @Column({
    type: 'enum',
    enum: Priority,
  })
  priority: Priority;

  @Column({ type: 'datetime' })
  assigned_at: Date;

  @Column({ type: 'datetime' })
  due_date: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at: Date;

  @Column({ type: 'datetime', nullable: true })
  scheduled_datetime: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  requires_manager_check: boolean;

  @Column({ type: 'int', default: 0 })
  rejecting_times: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department_group_id: string;

  @Column({ type: 'json', nullable: true })
  recurrence_settings: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  parent_recurrence_id: string;

  @Column({
    type: 'enum',
    enum: AssignmentMode,
    default: AssignmentMode.INDIVIDUAL,
  })
  assignment_mode: AssignmentMode;

  /** Pentru FCFS: câți „primii” pot accepta (1 = doar primul, 2+ = primii 2, 3, etc.). Default 1. */
  @Column({ name: 'max_acceptances', type: 'int', nullable: true, default: 1 })
  max_acceptances: number | null;

  @Column({ type: 'boolean', default: true })
  is_visible_for_employee: boolean;

  @Column({ type: 'boolean', default: false })
  was_postponed: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(
    () => TaskAssignmentElement,
    (element) => element.task_assignment,
    {
      cascade: ['insert', 'update', 'remove'],
      orphanedRowAction: 'delete',
    },
  )
  elements: TaskAssignmentElement[];

  @Column({ type: 'date', nullable: true })
  last_recurrence_generated_date: Date | null;
}

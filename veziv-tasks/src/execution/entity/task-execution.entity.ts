import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { TaskAssignment } from '../../assignment/entity/task-assignment.entity';
import { TaskExecutionAnswer } from './task-execution-answer.entity';
import { EmployeeDailyTaskPoints } from './employee-daily-task-points.entity';

@Entity('Task_Execution')
@Index(['task_assignment_id']) // Index pentru batch loading executions
@Index(['location_id']) // Index pentru filtrare după locație
@Index(['employee_id']) // Index pentru filtrare după angajat
@Index(['created_at']) // Index pentru sortare
@Index(['location_id', 'created_at']) // Index compus pentru filtrare + sortare
export class TaskExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_assignment_id', type: 'int' })
  task_assignment_id: number;

  @ManyToOne(() => TaskAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_assignment_id' })
  task_assignment: TaskAssignment;

  @Column({ name: 'employee_id', type: 'int' })
  employee_id: number;

  @Column({ type: 'int', nullable: true })
  location_id: number;

  @Column({ type: 'datetime' })
  started_at: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at: Date;

  @Column({ type: 'text', nullable: true })
  comment: string;


  @Column({ type: 'boolean', default: false })
  is_reactivation_compensation: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TaskExecutionAnswer, answer => answer.task_execution)
  answers: TaskExecutionAnswer[];

  @OneToMany(() => EmployeeDailyTaskPoints, taskPoints => taskPoints.task_execution)
  daily_task_points: EmployeeDailyTaskPoints[];
} 
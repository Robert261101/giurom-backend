import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EmployeeDailyPoints } from './employee-daily-points.entity';
import { TaskExecution } from './task-execution.entity';

@Entity('Employee_Daily_Task_Points')
export class EmployeeDailyTaskPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_daily_points_id', type: 'int' })
  employee_daily_points_id: number;

  @ManyToOne(() => EmployeeDailyPoints, dailyPoints => dailyPoints.task_points, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_daily_points_id' })
  employee_daily_points: EmployeeDailyPoints;

  /** Nullable pentru înregistrări agregate (ex: puncte manager la încasare – fără execuție task). */
  @Column({ name: 'task_execution_id', type: 'int', nullable: true })
  task_execution_id: number | null;

  @ManyToOne(() => TaskExecution, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'task_execution_id' })
  task_execution: TaskExecution | null;

  @Column({ name: 'points_awarded', type: 'decimal', precision: 10, scale: 2, default: 0 })
  points_awarded: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}












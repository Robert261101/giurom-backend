import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { EmployeeDailyTaskPoints } from './employee-daily-task-points.entity';

@Entity('Employee_Daily_Points')
export class EmployeeDailyPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employee_id: number;

  @Column({ name: 'work_date', type: 'date' })
  work_date: Date;

  @Column({ name: 'total_points', type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_points: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => EmployeeDailyTaskPoints, taskPoints => taskPoints.employee_daily_points)
  task_points: EmployeeDailyTaskPoints[];
}











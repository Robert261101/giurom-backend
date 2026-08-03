import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { EmployeeDailyTaskPoints } from './employee-daily-task-points.entity';

@Entity('Employee_Daily_Points')
@Index('uq_employee_daily_points_emp_date_loc', ['employee_id', 'work_date', 'location_id'], { unique: true })
export class EmployeeDailyPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employee_id: number;

  @Column({ name: 'work_date', type: 'date' })
  work_date: Date;

  /** Locația pentru care se înregistrează punctele (folosit la rapoarte și filtrare). Obligatoriu. */
  @Column({ name: 'location_id', type: 'int' })
  location_id: number;

  @Column({ name: 'total_points', type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_points: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => EmployeeDailyTaskPoints, taskPoints => taskPoints.employee_daily_points)
  task_points: EmployeeDailyTaskPoints[];
}












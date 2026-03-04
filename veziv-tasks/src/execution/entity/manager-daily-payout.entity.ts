import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Înregistrare zilnică: suma punctelor angajaților pe locație și zi,
 * transformată în sumă alocată managerului (total_points * manager_percent / 100).
 * Managerul este cel pontat în departamentul "Manager" în ziua respectivă.
 */
@Entity('manager_daily_payout')
@Index(['work_location_id', 'work_date'], { unique: true })
export class ManagerDailyPayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'work_location_id', type: 'int' })
  work_location_id: number;

  @Column({ name: 'work_date', type: 'date' })
  work_date: Date;

  @Column({ name: 'manager_employee_id', type: 'int' })
  manager_employee_id: number;

  @Column({ name: 'total_points', type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_points: number;

  /** Puncte alocate managerului (total_points * manager_percent / 100) – sursă unică pentru rapoarte. */
  @Column({ name: 'manager_points', type: 'decimal', precision: 12, scale: 2, default: 0 })
  manager_points: number;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @CreateDateColumn()
  created_at: Date;
}

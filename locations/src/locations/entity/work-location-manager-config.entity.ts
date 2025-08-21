import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('WorkLocation_ManagerConfig')
export class WorkLocationManagerConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'location_id' })
  work_location_id: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'manager_percentage' })
  manager_percent: number; // e.g., 10.00 = 10%

  // fallback_revenue_per_point removed per latest requirements

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}



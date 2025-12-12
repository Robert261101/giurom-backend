import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum RevenueStatus {
  Pending = 'pending',
  Approved = 'approved',
  Canceled = 'canceled',
}

@Entity('WorkLocation_Revenue')
export class WorkLocationRevenue {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'location_id' })
  work_location_id: number;

  @Index()
  @Column({ type: 'datetime' })
  revenue_date: string; // YYYY-MM-DD HH:MM:SS

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'online_amount', default: 0 })
  online_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_amount', default: 0 })
  cash_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'card_amount', default: 0 })
  card_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  total_amount: number;

  @Column({ type: 'enum', enum: RevenueStatus, nullable: true, name: 'status' })
  status?: RevenueStatus;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
  image_url?: string;

  @Index()
  @Column({ type: 'int', nullable: false, name: 'employee_id' })
  employee_id: number; // OBLIGATORIU - ID-ul angajatului care introduce încasarea

  @Column({ type: 'datetime', nullable: true, name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  created_at?: string;

  @Column({ type: 'datetime', nullable: true, name: 'updated_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at?: string;
}



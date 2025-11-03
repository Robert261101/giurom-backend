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

  // points_awarded removed per latest requirements

  // No created/updated columns per schema
}



import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('WorkLocation_Revenue')
export class WorkLocationRevenue {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'location_id' })
  work_location_id: number;

  @Index()
  @Column({ type: 'date' })
  revenue_date: string; // YYYY-MM-DD

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'amount' })
  revenue_amount: number;

  // points_awarded removed per latest requirements

  // No created/updated columns per schema
}



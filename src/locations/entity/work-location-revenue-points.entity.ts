import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('WorkLocation_RevenuePoints')
export class WorkLocationRevenuePoints {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'location_id' })
  work_location_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'min_amount' })
  min_revenue: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'max_amount' })
  max_revenue: number | null; // null means open-ended

  @Column({ type: 'decimal', precision: 12, scale: 4, name: 'points_per_unit' })
  points: number; // points granted when revenue in [min, max]

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  created_at: Date;
}



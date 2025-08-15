import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WorkLocation } from './work-location.entity';

@Entity('worklocation_tasktemplate')
export class WorkLocationTaskTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  location_id: number;

  @Column({ default: 1 })
  template_id: number;

  @Column({ type: 'datetime', nullable: true })
  assigned_at: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => WorkLocation, (location) => location.task_templates, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  work_location: WorkLocation;
} 
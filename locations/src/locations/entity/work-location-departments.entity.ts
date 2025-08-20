import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { WorkLocation } from './work-location.entity';
import { WorkLocationDepartmentPositions } from './work-location-department-positions.entity';

@Entity('worklocation_departments')
export class WorkLocationDepartments {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  name: string;

  @Column({ type: 'varchar', length: 20, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  code: string;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description: string | null;

  @Column()
  work_location_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => WorkLocation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'work_location_id' })
  work_location: WorkLocation;

  @OneToMany(() => WorkLocationDepartmentPositions, (position) => position.department, { cascade: true, eager: false })
  positions: WorkLocationDepartmentPositions[];
} 
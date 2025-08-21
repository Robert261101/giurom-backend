import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkLocationTaskTemplate } from '../entity/work-location-task-template.entity';
import { WorkLocationDepartments } from '../entity/work-location-departments.entity';
import { CompanyRef } from './company-ref.entity';

@Entity('work_location')
export class WorkLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  company_id: number;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  location_name: string;

  @Column({ type: 'text', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  address: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  city: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  county: string;

  @Column({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  postal_code: string | null;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci', default: 'Romania' })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  phone_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  email: string | null;

  // points column removed per new revenue points model

  @ManyToOne(() => CompanyRef, { onDelete: 'RESTRICT', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company?: CompanyRef;

  @Column({ type: 'date', name: 'created_at', nullable: true })
  created_at: Date | null;

  @Column({ type: 'int', nullable: true })
  employee_id: number | null;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  gps_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  gps_lng: number | null;

  @Column({ type: 'int', nullable: true })
  gps_radius_m: number | null;

  @OneToMany(() => WorkLocationTaskTemplate, (taskTemplate) => taskTemplate.work_location, { cascade: true, eager: false })
  task_templates: WorkLocationTaskTemplate[];

  @OneToMany(() => WorkLocationDepartments, (department) => department.work_location, { cascade: true, eager: false })
  departments: WorkLocationDepartments[];
} 
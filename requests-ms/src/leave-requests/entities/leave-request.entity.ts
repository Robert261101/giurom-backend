import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum DurationUnit {
  DAYS = 'days',
  HOURS = 'hours',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('leave_requests')
export class LeaveRequest {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID angajat care face cererea', example: 1 })
  @Column()
  employee_id: number;

  @ApiProperty({ 
    description: 'ID locație de lucru asociată cererii', 
    example: 1,
    required: false 
  })
  @Column({ nullable: true })
  location_id?: number;

  @ApiProperty({ 
    description: 'Tipul concediului', 
    example: 'Concediu de odihnă',
    maxLength: 100 
  })
  @Column({ 
    type: 'varchar', 
    length: 100,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  leave_type: string;

  @ApiProperty({ 
    description: 'Data și ora de început a concediului', 
    example: '2024-08-01T00:00:00Z' 
  })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit a concediului', 
    example: '2024-08-05T23:59:59Z' 
  })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({ 
    description: 'Comentariul/motivul cererii', 
    example: 'Concediu planificat pentru vacanța de vară',
    required: false 
  })
  @Column({ 
    type: 'text', 
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  comment?: string;

  @ApiProperty({ 
    description: 'Unitatea de măsură pentru durată', 
    enum: DurationUnit, 
    example: DurationUnit.DAYS 
  })
  @Column({ type: 'enum', enum: DurationUnit, default: DurationUnit.DAYS })
  duration_unit: DurationUnit;

  @ApiProperty({ 
    description: 'Statusul cererii', 
    enum: LeaveStatus, 
    example: LeaveStatus.PENDING 
  })
  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @ApiProperty({ 
    description: 'ID manager care a aprobat/respins cererea', 
    example: 2,
    required: false 
  })
  @Column({ nullable: true })
  reviewed_by_id?: number;

  @ApiProperty({ 
    description: 'Data și ora când a fost aprobată/respinsă cererea', 
    example: '2024-07-26T10:30:00Z',
    required: false 
  })
  @Column({ type: 'datetime', nullable: true })
  reviewed_at?: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  // Employee relationship removed - using HTTP calls to employees microservice

  // Computed properties
  get duration_in_days(): number {
    const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get duration_in_hours(): number {
    const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }
}
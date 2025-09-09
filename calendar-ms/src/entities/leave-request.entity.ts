import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum LeaveRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum LeaveType {
  DAYS = 'days',
  HOURS = 'hours',
}

export enum DurationUnit {
  DAYS = 'days',
  HOURS = 'hours',
}

@Entity('leave_request')
export class LeaveRequest {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID angajat', example: 1 })
  @Column({ type: 'int' })
  employee_id: number;

  @ApiProperty({ description: 'Tip concediu', maxLength: 100 })
  @Column({ 
    type: 'varchar', 
    length: 100,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  leave_type: string;

  @ApiProperty({ description: 'Data și ora început', example: '2024-07-25T09:00:00Z' })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ description: 'Data și ora sfârșit', example: '2024-07-25T17:00:00Z' })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({ description: 'Comentariu', example: 'Concediu pentru odihnă', required: false })
  @Column({ 
    type: 'text', 
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  comment?: string;

  @ApiProperty({ description: 'Unitatea de durată', enum: DurationUnit, example: DurationUnit.DAYS })
  @Column({
    type: 'enum',
    enum: DurationUnit
  })
  duration_unit: DurationUnit;

  @ApiProperty({ description: 'Status cerere', enum: LeaveRequestStatus, example: LeaveRequestStatus.PENDING })
  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING
  })
  status: LeaveRequestStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ApiProperty({ description: 'ID reviewer', example: 3 })
  @Column({ type: 'int' })
  reviewed_by_id: number;

  @ApiProperty({ description: 'Data review', example: '2024-07-25T10:00:00Z' })
  @Column({ type: 'datetime' })
  reviewed_at: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum ShiftChangeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('shift_change_requests')
export class ShiftChangeRequests {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID angajat', example: 1 })
  @Column({ type: 'int' })
  employee_id: number;

  @ApiProperty({ description: 'ID înlocuitor', example: 2 })
  @Column({ type: 'int' })
  replacement_id: number;

  @ApiProperty({ description: 'Data și ora început', example: '2024-07-25T09:00:00Z' })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ description: 'Data și ora sfârșit', example: '2024-07-25T17:00:00Z' })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({ description: 'Comentariu', example: 'Cerere schimb pentru vizită medicală', required: false })
  @Column({ 
    type: 'text', 
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  comment?: string;

  @ApiProperty({ description: 'Status cerere', enum: ShiftChangeStatus, example: ShiftChangeStatus.PENDING })
  @Column({
    type: 'enum',
    enum: ShiftChangeStatus,
    default: ShiftChangeStatus.PENDING
  })
  status: ShiftChangeStatus;

  @ApiProperty({ description: 'ID reviewer', example: 3 })
  @Column({ type: 'int' })
  reviewed_by_id: number;

  @ApiProperty({ description: 'Data review', example: '2024-07-25T10:00:00Z' })
  @Column({ type: 'datetime' })
  reviewed_at: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
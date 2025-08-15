import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '../../employee/entities/employee.entity';

export enum ShiftChangeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('shift_change_requests')
export class ShiftChangeRequest {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID angajat care cere schimbul', example: 1 })
  @Column()
  employee_id: number;

  @ApiProperty({ description: 'ID angajat propus ca înlocuitor', example: 2 })
  @Column()
  replacement_id: number;

  @ApiProperty({ 
    description: 'Data și ora de început a schimbului', 
    example: '2024-08-01T08:00:00Z' 
  })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit a schimbului', 
    example: '2024-08-01T16:00:00Z' 
  })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({ 
    description: 'Comentariul/motivul cererii de schimb', 
    example: 'Am o urgență medicală și nu pot lucra în această tură',
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
    description: 'Statusul cererii', 
    enum: ShiftChangeStatus, 
    example: ShiftChangeStatus.PENDING 
  })
  @Column({ type: 'enum', enum: ShiftChangeStatus, default: ShiftChangeStatus.PENDING })
  status: ShiftChangeStatus;

  @ApiProperty({ 
    description: 'ID manager care a aprobat/respins cererea', 
    example: 3,
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
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'replacement_id' })
  replacement: Employee;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewed_by?: Employee;

  // Computed properties
  get duration_in_hours(): number {
    const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }

  get shift_date(): string {
    return this.start_datetime.toISOString().split('T')[0];
  }
}
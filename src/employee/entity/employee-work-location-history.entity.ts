import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from './employee.entity';

@Entity('employee_work_location_history')
export class EmployeeWorkLocationHistory {
  @ApiProperty({
    description: 'ID-ul unic al înregistrării din istoric',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @Column()
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @Column()
  work_location_id: number;

  @ApiProperty({
    description: 'Descrierea mutării sau schimbării',
    example: 'Transferat de la sediul central la filiala Cluj',
  })
  @Column({
    type: 'text',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  description: string;

  @ApiProperty({
    description: 'Data creării înregistrării',
    example: '2023-12-01T10:00:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Angajatul asociat cu acest istoric',
    type: () => Employee,
  })
  @ManyToOne(() => Employee, employee => employee.workLocationHistory)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
} 
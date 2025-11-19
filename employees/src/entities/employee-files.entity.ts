import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from './employee.entity';

@Entity('employee_files')
export class EmployeeFiles {
  @ApiProperty({
    description: 'ID-ul unic al fișierului',
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
    description: 'Numele fișierului',
    example: 'CV_Ion_Popescu.pdf',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_name: string;

  @ApiProperty({
    description: 'Tipul fișierului',
    example: 'pdf',
    maxLength: 100,
  })
  @Column({
    type: 'varchar',
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier',
    example: '/files/employees/1/document.pdf',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_link: string;

  @ApiProperty({
    description: 'Data expirării documentului',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @Column({ type: 'datetime', nullable: true, default: null })
  expire_date: Date | null;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Angajatul asociat cu acest fișier',
    type: () => Employee,
  })
  @ManyToOne(() => Employee, employee => employee.employeeFiles)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}
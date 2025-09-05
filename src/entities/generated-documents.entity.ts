import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from './employee.entity';

@Entity('generated_documents')
export class GeneratedDocuments {
  @ApiProperty({
    description: 'ID-ul unic al documentului generat',
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
    description: 'ID-ul documentului template',
    example: 1,
  })
  @Column()
  doc_id: number;

  @ApiProperty({
    description: 'Statusul documentului',
    example: 'completed',
    maxLength: 50,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  status: string;

  @ApiProperty({
    description: 'Data semnării documentului',
    example: '2023-12-15T10:30:00Z',
  })
  @Column({ type: 'datetime' })
  signed_at: Date;

  @ApiProperty({
    description: 'Data expirării documentului',
    example: '2024-12-15',
  })
  @Column('date')
  expired_date: Date;

  // Relații
  @ApiProperty({
    description: 'Angajatul asociat cu acest document',
    type: () => Employee,
  })
  @ManyToOne(() => Employee, employee => employee.generatedDocuments)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}
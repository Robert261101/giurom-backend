import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EmployeeWorkLocationHistory } from './employee-work-location-history.entity';
import { EmployeeFiles } from './employee-files.entity';
import { GeneratedDocuments } from './generated-documents.entity';

@Entity('employees')
export class Employee {
  @ApiProperty({
    description: 'ID-ul unic al angajatului',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Prenumele angajatului',
    example: 'Ion',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  first_name: string;

  @ApiProperty({
    description: 'Numele de familie al angajatului',
    example: 'Popescu',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  last_name: string;

  @ApiProperty({
    description: 'Adresa de email a angajatului',
    example: 'ion.popescu@giurom.ro',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  email: string;

  @ApiProperty({
    description: 'Numărul de telefon al angajatului',
    example: '+40712345678',
    maxLength: 20,
  })
  @Column({
    type: 'varchar',
    length: 20,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  phone: string;

  @ApiProperty({
    description: 'Numărul personal (CNP)',
    example: '1234567890123',
    maxLength: 15,
  })
  @Column({
    type: 'varchar',
    length: 15,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  personal_number: string;

  @ApiProperty({
    description: 'Data nașterii',
    example: '1990-05-15',
  })
  @Column('date')
  birth_date: Date;

  @ApiProperty({
    description: 'Genul angajatului',
    example: 'male',
    enum: ['male', 'female', 'other'],
  })
  @Column({
    type: 'enum',
    enum: ['male', 'female', 'other']
  })
  gender: string;

  @ApiProperty({
    description: 'Starea civilă',
    example: 'single',
    enum: ['single', 'married', 'other'],
    required: false,
  })
  @Column({
    type: 'enum',
    enum: ['single', 'married', 'other'],
    nullable: true
  })
  marital_status: string;

  @ApiProperty({
    description: 'Naționalitatea angajatului',
    example: 'Română',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  nationality: string;

  @ApiProperty({
    description: 'Adresa completă a angajatului',
    example: 'Str. Exemplu nr. 123, București',
  })
  @Column({
    type: 'text',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  address: string;

  @ApiProperty({
    description: 'Data angajării',
    example: '2023-01-15',
  })
  @Column('date')
  hire_date: Date;

  @ApiProperty({
    description: 'Data încetării contractului',
    example: '2025-01-15',
    required: false,
  })
  @Column('date', { nullable: true })
  termination_date: Date;

  @ApiProperty({
    description: 'ID-ul poziției implicite',
    example: 1,
    required: false,
  })
  @Column({ nullable: true })
  position_default_id: number;

  @ApiProperty({
    description: 'ID-ul departamentului implicit',
    example: 1,
    required: false,
  })
  @Column({ nullable: true })
  department_default_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru implicite',
    example: 1,
    required: false,
  })
  @Column({ nullable: true })
  work_location_default_id: number;

  @ApiProperty({
    description: 'Tipul contractului',
    example: 'permanent',
    enum: ['permanent', 'fixed-term', 'internship'],
  })
  @Column({
    type: 'enum',
    enum: ['permanent', 'fixed-term', 'internship']
  })
  contract_type: string;

  @ApiProperty({
    description: 'Indică dacă angajatul este activ',
    example: true,
    default: true,
  })
  @Column({ default: true })
  is_active: boolean;

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
    description: 'Istoricul locațiilor de lucru ale angajatului',
    type: () => [EmployeeWorkLocationHistory],
  })
  @OneToMany(() => EmployeeWorkLocationHistory, history => history.employee)
  workLocationHistory: EmployeeWorkLocationHistory[];

  @ApiProperty({
    description: 'Fișierele angajatului',
    type: () => [EmployeeFiles],
  })
  @OneToMany(() => EmployeeFiles, file => file.employee)
  employeeFiles: EmployeeFiles[];

  @ApiProperty({
    description: 'Documentele generate pentru angajat',
    type: () => [GeneratedDocuments],
  })
  @OneToMany(() => GeneratedDocuments, document => document.employee)
  generatedDocuments: GeneratedDocuments[];
} 
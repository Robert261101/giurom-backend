import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

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

  // Computed property pentru numele complet
  get full_name(): string {
    return `${this.first_name} ${this.last_name}`;
  }
}
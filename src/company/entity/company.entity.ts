import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyDocument } from './company-document.entity';
import { WorkLocation } from '../../locations/entity/work-location.entity';

@Entity('companies')
export class Company {
  @ApiProperty({
    description: 'ID-ul unic al companiei',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Numele companiei',
    example: 'SC Giurom SRL',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  company_name: string;

  @ApiProperty({
    description: 'Codul Unic de Înregistrare (CUI)',
    example: 'RO12345678',
    maxLength: 20,
  })
  @Column({
    type: 'varchar',
    length: 20,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  cui: string;

  @ApiProperty({
    description: 'Numărul de înregistrare din registrul comerțului',
    example: 'J40/1234/2023',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  trade_register_number: string;

  @ApiProperty({
    description: 'Adresa completă a companiei',
    example: 'Str. Exemplu nr. 123, Sector 1',
  })
  @Column({
    type: 'varchar',
    length: 500,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  address: string;

  @ApiProperty({
    description: 'Orașul în care se află compania',
    example: 'București',
    maxLength: 100,
  })
  @Column({
    type: 'varchar',
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  city: string;

  @ApiProperty({
    description: 'Județul în care se află compania',
    example: 'București',
    maxLength: 100,
    default: 'Romania',
  })
  @Column({
    type: 'varchar',
    length: 100,
    default: 'Romania',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  county: string;

  @ApiProperty({
    description: 'Codul poștal',
    example: '010101',
    maxLength: 20,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  postal_code: string;

  @ApiProperty({
    description: 'Țara în care se află compania',
    example: 'Romania',
    maxLength: 100,
    default: 'Romania',
  })
  @Column({
    type: 'varchar',
    length: 100,
    default: 'Romania',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  country: string;

  @ApiProperty({
    description: 'Numărul de telefon al companiei',
    example: '+40712345678',
    maxLength: 20,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  phone_number: string;

  @ApiProperty({
    description: 'Adresa de email a companiei',
    example: 'contact@giurom.com',
    maxLength: 255,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  email: string;

  @ApiProperty({
    description: 'Data înregistrării companiei',
    example: '2023-01-15',
  })
  @Column('date')
  incorporation_date: Date;

  @ApiProperty({
    description: 'Forma juridică a companiei',
    example: 'SRL',
    maxLength: 100,
    enum: ['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'],
  })
  @Column({
    type: 'varchar',
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  legal_form: string;

  @ApiProperty({
    description: 'Codul de activitate principal (CAEN)',
    example: '6201',
    maxLength: 10,
  })
  @Column({
    type: 'varchar',
    length: 10,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  activity_code: string;

  @ApiProperty({
    description: 'Indică dacă compania este plătitoare de TVA',
    example: false,
    default: false,
  })
  @Column({ default: false })
  vat_payer: boolean;

  @ApiProperty({
    description: 'Numele băncii',
    example: 'BCR',
    maxLength: 255,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  bank_name: string;

  @ApiProperty({
    description: 'Numărul contului bancar (IBAN)',
    example: 'RO49AAAA1B31007593840000',
    maxLength: 34,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 34,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  bank_account_number: string;

  @ApiProperty({
    description: 'Site-ul web al companiei',
    example: 'https://www.giurom.com',
    maxLength: 255,
    required: false,
  })
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  website: string;

  @ApiProperty({
    description: 'Statusul companiei',
    example: 'activ',
    enum: ['activ', 'inactiv', 'suspendat'],
    default: 'activ',
  })
  @Column({
    type: 'varchar',
    length: 50,
    default: 'activ',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  status: string;

  @ApiProperty({
    description: 'Note sau observații despre companie',
    example: 'Companie nou înregistrată',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  notes: string;

  @ApiProperty({
    description: 'Data când a fost creată înregistrarea',
    example: '2023-12-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări a înregistrării',
    example: '2023-12-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Documentele asociate companiei',
    type: () => [CompanyDocument],
  })
  @OneToMany(() => CompanyDocument, (document) => document.company, {
    cascade: true,
    eager: false,
  })
  documents: CompanyDocument[];

  @ApiProperty({
    description: 'Locațiile de lucru ale companiei',
    type: () => [WorkLocation],
  })
  @OneToMany(() => WorkLocation, (location) => location.company, {
    cascade: true,
    eager: false,
  })
  work_locations: WorkLocation[];
} 
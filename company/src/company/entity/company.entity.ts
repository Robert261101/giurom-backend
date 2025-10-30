import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CompanyDocument } from './company-document.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  company_name: string;

  @Column({ type: 'varchar', length: 20, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  cui: string;

  @Column({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  trade_register_number: string;

  @Column({ type: 'varchar', length: 500, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  address: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  city: string;

  @Column({ type: 'varchar', length: 100, default: 'Romania', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  county: string;

  @Column({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  postal_code: string | null;

  @Column({ type: 'varchar', length: 100, default: 'Romania', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  phone_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  email: string | null;

  @Column('date')
  incorporation_date: Date;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  legal_form: string;

  @Column({ type: 'varchar', length: 10, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  activity_code: string;

  @Column({ default: false })
  vat_payer: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 34, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  bank_account_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  website: string | null;

  @Column({ type: 'varchar', length: 50, default: 'activ', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  status: string;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @OneToMany(() => CompanyDocument, (document) => document.company, { cascade: true, eager: false })
  documents: CompanyDocument[];
} 
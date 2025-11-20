import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from './company.entity';

@Entity('company_document')
export class CompanyDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  company_id: number;

  @Column({ type: 'varchar', length: 255 })
  document_name: string;

  @Column({ type: 'varchar', length: 100 })
  document_type: string;

  @Column({ type: 'text' })
  location_path: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  folder: string | null;

  @Column({ type: 'date' })
  upload_date: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  expire_date: Date | null;

  @ManyToOne(() => Company, (company) => company.documents, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
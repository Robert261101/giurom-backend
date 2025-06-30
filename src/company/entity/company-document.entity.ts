import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Company } from './company.entity';

@Entity('company_document')
export class CompanyDocument {
  @ApiProperty({
    description: 'ID-ul unic al documentului',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul companiei la care aparține documentul',
    example: 1,
  })
  @Column()
  company_id: number;

  @ApiProperty({
    description: 'Numele fișierului documentului',
    example: 'certificat_inmatriculare.pdf',
    maxLength: 255,
  })
  @Column({ type: 'varchar', length: 255 })
  document_name: string;

  @ApiProperty({
    description: 'Tipul documentului',
    example: 'Certificat de înmatriculare',
    maxLength: 100,
  })
  @Column({ type: 'varchar', length: 100 })
  document_type: string;

  @ApiProperty({
    description: 'Calea către documentul stocat pe disk',
    example: '/uploads/documents/2023/12/certificat_1.pdf',
  })
  @Column({ type: 'text' })
  location_path: string;

  @ApiProperty({
    description: 'Data încărcării documentului',
    example: '2023-01-15',
  })
  @Column({ type: 'date' })
  upload_date: Date;

  @ApiProperty({
    description: 'Note despre document',
    example: 'Document original scanat',
  })
  @Column({ type: 'text', nullable: true })
  notes: string;



  // Relații
  @ApiProperty({
    description: 'Compania la care aparține documentul',
    type: () => Company,
  })
  @ManyToOne(() => Company, (company) => company.documents, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;
} 
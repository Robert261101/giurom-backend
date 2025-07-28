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
import { SupplierFolder } from './supplier-folder.entity';

export enum DocumentType {
  CONTRACT = 'contract',
  INVOICE = 'invoice',
  CERTIFICATE = 'certificate',
  ORDER = 'order',
  OTHER = 'other',
}

@Entity('supplier_documents')
export class SupplierDocument {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID folder', example: 1 })
  @Column()
  folder_id: number;

  @ApiProperty({ description: 'Tipul documentului', enum: DocumentType, example: DocumentType.CONTRACT })
  @Column({ type: 'enum', enum: DocumentType })
  document_type: DocumentType;

  @ApiProperty({ description: 'Numele fișierului', example: 'contract_alimentara.pdf' })
  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  file_name: string;

  @ApiProperty({ description: 'Calea fișierului în cloud', example: '/suppliers/1/alimentara-srl/data/contract_alimentara.pdf' })
  @Column({ type: 'varchar', length: 500 })
  file_path: string;

  @ApiProperty({ description: 'Note despre document', example: 'Contract de furnizare valabil până în 2025', required: false })
  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes?: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => SupplierFolder, (folder) => folder.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folder_id' })
  folder: SupplierFolder;
}
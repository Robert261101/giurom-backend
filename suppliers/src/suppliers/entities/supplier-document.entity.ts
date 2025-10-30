import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
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
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  folder_id: number;

  @Column({ type: 'enum', enum: DocumentType })
  document_type: DocumentType;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  file_name: string;

  @Column({ type: 'varchar', length: 500 })
  file_path: string;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  notes?: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => SupplierFolder, (folder) => folder.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folder_id' })
  folder: SupplierFolder;
}



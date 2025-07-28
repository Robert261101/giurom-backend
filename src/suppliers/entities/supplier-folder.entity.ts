import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Supplier } from './supplier.entity';
import { SupplierDocument } from './supplier-document.entity';

@Entity('supplier_folders')
export class SupplierFolder {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID furnizor', example: 1 })
  @Column()
  supplier_id: number;

  @ApiProperty({ description: 'Descrierea folderului', example: 'Folder pentru documente contractuale' })
  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description: string;

  @ApiProperty({ description: 'Calea folderului în cloud', example: '/suppliers/1/alimentara-srl/data/' })
  @Column({ type: 'varchar', length: 500 })
  folder_path: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Supplier, (supplier) => supplier.folders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => SupplierDocument, (document) => document.folder)
  documents: SupplierDocument[];
}
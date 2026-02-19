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
import { Supplier } from './supplier.entity';
import { SupplierDocument } from './supplier-document.entity';

@Entity('supplier_folders')
export class SupplierFolder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_id: number;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description: string;

  @Column({ type: 'varchar', length: 500, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  folder_path: string;

  @Column({ type: 'int', nullable: true })
  parent_id: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.folders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => SupplierFolder, (parent) => parent.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: SupplierFolder | null;

  @OneToMany(() => SupplierFolder, (child) => child.parent)
  children: SupplierFolder[];

  @OneToMany(() => SupplierDocument, (document) => document.folder)
  documents: SupplierDocument[];
}



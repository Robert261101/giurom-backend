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
import { SupplierOrder } from './supplier-order.entity';

@Entity('supplier_order_documents')
export class SupplierOrderDocument {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID comandă', example: 1 })
  @Column()
  order_id: number;

  @ApiProperty({ description: 'Tipul documentului', example: 'order_pdf' })
  @Column({ type: 'varchar', length: 50 })
  document_type: string;

  @ApiProperty({ description: 'Numele fișierului', example: 'comanda_001_alimentara.pdf' })
  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  file_name: string;

  @ApiProperty({ description: 'Calea fișierului în cloud', example: '/suppliers/1/alimentara-srl/orders/comanda_001_alimentara.pdf' })
  @Column({ type: 'varchar', length: 500 })
  file_path: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => SupplierOrder, (order) => order.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SupplierOrder;
}
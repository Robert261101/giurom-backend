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
import { Supplier } from './supplier.entity';
import { Product } from '../../stock/entities/product.entity';

@Entity('supplier_products')
export class SupplierProduct {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID furnizor', example: 1 })
  @Column()
  supplier_id: number;

  @ApiProperty({ description: 'ID produs din nomenclator', example: 1 })
  @Column()
  product_id: number;

  @ApiProperty({ description: 'Numele produsului specific furnizorului', example: 'Făină Extra 000 - Ambalaj 25kg' })
  @Column({ type: 'varchar', length: 200, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  product_name: string;

  @ApiProperty({ description: 'Descrierea produsului specific furnizorului', example: 'Făină de grâu tip 000, ambalaj sac 25kg, marca Alimentara' })
  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  product_description?: string;

  @ApiProperty({ description: 'Unitatea de măsură specifică furnizorului', example: 'sac 25kg' })
  @Column({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  unit_of_measure: string;

  @ApiProperty({ description: 'Prețul pe unitate', example: 45.50 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_unit: number;

  @ApiProperty({ description: 'Produsul este activ la acest furnizor', example: true })
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Supplier, (supplier) => supplier.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
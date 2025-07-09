import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Product } from './product.entity';
import { Locator } from './locator.entity';
import { StockTransaction } from './stock-transaction.entity';

export enum StockStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  BELOW_MINIMUM = 'below_minimum',
}

@Entity('stock')
export class Stock {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID produs', example: 1 })
  @Column()
  product_id: number;

  @ApiProperty({ description: 'ID locator', example: 1 })
  @Column()
  locator_id: number;

  @ApiProperty({ description: 'Cantitate disponibilă', example: 100.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @ApiProperty({ description: 'Preț unitar de achiziție', example: 3.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ApiProperty({ description: 'Data intrării în stoc', example: '2024-07-01T10:00:00Z' })
  @Column({ type: 'datetime' })
  entry_date: Date;

  @ApiProperty({ description: 'Data expirării', example: '2024-09-01T00:00:00Z', required: false })
  @Column({ type: 'datetime', nullable: true })
  expiration_date?: Date;

  @ApiProperty({ description: 'Ultima actualizare cantitate', example: '2024-07-15T11:00:00Z', required: false })
  @Column({ type: 'datetime', nullable: true })
  last_update?: Date;

  @ApiProperty({ description: 'Status', enum: StockStatus, example: StockStatus.VALID })
  @Column({ type: 'enum', enum: StockStatus, default: StockStatus.VALID })
  status: StockStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Product, (product) => product.stocks, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Locator, (locator) => locator.stocks, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'locator_id' })
  locator: Locator;

  @OneToMany(() => StockTransaction, (tx) => tx.stock)
  transactions: StockTransaction[];
} 
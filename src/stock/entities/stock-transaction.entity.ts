import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Stock } from './stock.entity';

export enum TransactionType {
  ENTRY = 'entry',
  EXIT = 'exit',
}

@Entity('stock_transactions')
export class StockTransaction {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID stoc', example: 1 })
  @Column()
  stock_id: number;

  @ApiProperty({ description: 'Tipul tranzacției', enum: TransactionType, example: TransactionType.ENTRY })
  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ description: 'Cantitate', example: 10 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @ApiProperty({ description: 'Locația', example: 'Bucătărie', maxLength: 150 })
  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  location: string;

  @ApiProperty({ description: 'Destinația', example: 'Rețeta Supă', maxLength: 150, required: false })
  @Column({ type: 'varchar', length: 150, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  target?: string;

  @ApiProperty({ description: 'Timestamp', example: '2024-07-15T10:00:00Z' })
  @CreateDateColumn({ type: 'datetime' })
  timestamp: Date;

  @ManyToOne(() => Stock, (stock) => stock.transactions, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
} 
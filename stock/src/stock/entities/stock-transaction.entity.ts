import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Stock } from './stock.entity';

export enum TransactionType {
  ENTRY = 'entry',
  EXIT = 'exit',
}

@Entity('stock_transactions')
export class StockTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  stock_id: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  location: string;

  @Column({ type: 'varchar', length: 150, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  target?: string;

  @CreateDateColumn({ type: 'datetime' })
  timestamp: Date;

  @ManyToOne(() => Stock, (stock) => stock.transactions, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}



import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum TransactionTypeRef {
  ENTRY = 'entry',
  EXIT = 'exit',
}

@Entity('stock_transactions')
export class StockTransactionRef {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  stock_id: number;

  @Column({ type: 'enum', enum: TransactionTypeRef })
  type: TransactionTypeRef;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 150 })
  location: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  target?: string | null;

  @Column({ type: 'datetime' })
  timestamp: Date;
}



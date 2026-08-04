import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stock } from './stock.entity';
import { StockLotStatus, StockSource, TransactionType } from './stock.enums';

export { TransactionType } from './stock.enums';

@Entity('stock_transactions')
export class StockTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  stock_id: number;

  @Column({ type: 'int', nullable: true })
  legacy_lot_id?: number | null;

  @Column({ type: 'int' })
  product_id: number;

  @Column({ type: 'int', nullable: true })
  location_id?: number | null;

  @Column({ type: 'int' })
  location_key: number;

  @Column({ type: 'int', nullable: true })
  supplier_order_item_id?: number | null;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number | null;

  @Column({ type: 'datetime', nullable: true })
  entry_date?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  expiration_date?: Date | null;

  @Column({ type: 'enum', enum: StockSource, nullable: true })
  source?: StockSource | null;

  @Column({ type: 'enum', enum: StockLotStatus, nullable: true })
  status?: StockLotStatus | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  document_url?: string | null;

  @Column({
    type: 'varchar',
    length: 150,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  location: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  target?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reference_type?: string | null;

  @Column({ type: 'int', nullable: true })
  reference_id?: number | null;

  @CreateDateColumn({ type: 'datetime' })
  timestamp: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  updated_at?: Date | null;

  @ManyToOne(() => Stock, (stock) => stock.transactions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;
}

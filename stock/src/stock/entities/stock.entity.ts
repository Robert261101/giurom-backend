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
import { Product } from './product.entity';
import { StockTransaction } from './stock-transaction.entity';

export enum StockStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  BELOW_MINIMUM = 'below_minimum',
}

export enum StockSource {
  MANUAL = 'manual',
  COMANDA = 'comanda',
}

@Entity('stock')
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @Column({ nullable: true })
  location_id?: number;

  @Column({ nullable: true })
  supplier_order_item_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'datetime' })
  entry_date: Date;

  @Column({ type: 'datetime', nullable: true })
  expiration_date?: Date;

  @Column({ type: 'datetime', nullable: true })
  last_update?: Date;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  document_url?: string;

  @Column({ type: 'enum', enum: StockSource, default: StockSource.MANUAL })
  source: StockSource;

  @Column({ type: 'enum', enum: StockStatus, default: StockStatus.VALID })
  status: StockStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Product, (product) => product.stocks, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => StockTransaction, (tx) => tx.stock)
  transactions: StockTransaction[];

  // location_id is a reference field only - no FK relationship
  // Location data retrieved via HTTP calls to locations microservice when needed
}



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
import { StockStatus } from './stock.enums';

export { StockStatus, StockSource, StockLotStatus } from './stock.enums';

@Entity('stock')
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  product_id: number;

  @Column({ type: 'int', nullable: true })
  location_id?: number | null;

  /** IFNULL(location_id, -1) — matches DB unique key helper. */
  @Column({ type: 'int' })
  location_key: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ type: 'enum', enum: StockStatus, default: StockStatus.VALID })
  status: StockStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Product, (product) => product.stocks, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => StockTransaction, (tx) => tx.stock)
  transactions: StockTransaction[];
}

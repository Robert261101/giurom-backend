import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum StockStatusRef {
  VALID = 'valid',
  EXPIRED = 'expired',
  BELOW_MINIMUM = 'below_minimum',
}

@Entity('stock')
export class StockRef {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'datetime' })
  entry_date: Date;

  @Column({ type: 'datetime', nullable: true })
  expiration_date?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  last_update?: Date | null;

  @Column({ type: 'enum', enum: StockStatusRef, default: StockStatusRef.VALID })
  status: StockStatusRef;
}



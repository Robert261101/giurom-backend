import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OrderListStatus = 'in_asteptare' | 'checked';

@Entity('order_lists')
export class OrderList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  work_location_id: number;

  @Column({ type: 'date' })
  list_date: string;

  @Column({ type: 'varchar', length: 20, default: 'in_asteptare' })
  status: OrderListStatus;

  @Column({ type: 'json', nullable: true })
  items: Array<{
    id: string;
    product_id: number;
    name: string;
    unit?: string;
    quantity: number;
    category?: string;
    supplier_id?: number;
    supplier_name?: string;
    price_per_unit?: number;
  }> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupplierOrder } from './supplier-order.entity';

export enum ReceptionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('supplier_order_item_receptions')
export class SupplierOrderItemReception {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  supplier_order_id: number;

  @ManyToOne(() => SupplierOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_order_id' })
  order: SupplierOrder;

  @Index()
  @Column()
  supplier_order_item_id: number;

  @Index()
  @Column()
  product_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  received_delta: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  returned_delta: number;

  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  reason?: string;

  @Column({ type: 'int', nullable: true })
  user_id?: number;

  @Column({ type: 'int', nullable: true })
  location_id?: number;

  @Column({ type: 'datetime' })
  occurred_at: Date;

  /** Legacy column name; new records store stock_transactions.id (ENTRY) from POST /stock/items. */
  @Column({ type: 'int', nullable: true })
  stock_item_id?: number;

  @Column({ 
    type: 'enum', 
    enum: ReceptionStatus, 
    default: ReceptionStatus.PENDING 
  })
  @Index()
  status: ReceptionStatus;

  /**
   * Comun tuturor rândurilor create în același apel de recepție — grupează liniile
   * într-un document de intrare. `occurred_at` nu poate servi la asta: se calculează
   * per rând, deci diferă în milisecunde. NULL pe rândurile istorice.
   */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  reception_batch_id?: string | null;

  /** Comun rândurilor aprobate în același apel `approveReceptions`. */
  @Column({ type: 'datetime', nullable: true })
  approved_at?: Date | null;

  /**
   * Cantitatea intrată efectiv în stoc, după conversia gross→net aplicată la aprobare.
   * Salvată aici ca documentul de intrare exportat să arate exact ce a intrat, fără ca
   * exportul să reia (și eventual să divergă de) logica de conversie.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  net_quantity?: number | null;

  /**
   * Gestiunea pe care intră această tranșă în giurom 2.0, moștenită din linia de comandă.
   *
   * Trăiește pe recepție, nu doar pe comandă, fiindcă o linie se recepționează în tranșe
   * (`newlyReceivedQty`), iar tranșele pot ajunge în gestiuni diferite — jumătate la depozit,
   * jumătate direct la bar. Cu eticheta doar pe comandă, cazul s-ar pierde tăcut.
   */
  @Column({ type: 'int', nullable: true })
  giurom2_zone_id?: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}

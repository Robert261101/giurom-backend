import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SupplierProductClientPriceHistoryAction {
  CREATED = 'created',
  UPDATED = 'updated',
  REMOVED = 'removed',
}

export enum SupplierProductClientPriceEditSource {
  WITHOUT_VAT = 'without_vat',
  WITH_VAT = 'with_vat',
}

@Entity('supplier_product_client_price_history')
@Index('idx_price_history_client_product_changed', [
  'client_company_id',
  'supplier_product_id',
  'changed_at',
])
export class SupplierProductClientPriceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  supplier_company_id: number;

  @Column({ type: 'int' })
  client_company_id: number;

  @Column({ type: 'int' })
  supplier_product_id: number;

  /** Canonical preferred price without VAT at the time of change. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  old_price: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  new_price: number | null;

  /** VAT % snapshotted at change time (for auditable with-VAT reconstruction). */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  vat_rate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  old_price_with_vat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  new_price_with_vat: number | null;

  @Column({
    type: 'enum',
    enum: SupplierProductClientPriceEditSource,
    nullable: true,
  })
  edit_source: SupplierProductClientPriceEditSource | null;

  /** Standard (list) price without VAT at the moment of the change. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standard_price_snapshot: number | null;

  /** Standard price with VAT at the moment of the change (derived from snapshot + vat_rate). */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standard_price_with_vat_snapshot: number | null;

  @Column({
    type: 'enum',
    enum: SupplierProductClientPriceHistoryAction,
  })
  action: SupplierProductClientPriceHistoryAction;

  @Column({ type: 'int', nullable: true })
  changed_by_user_id: number | null;

  /** Display name snapshotted at change time (survives rename/delete). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  changed_by_name: string | null;

  /** Stored as UTC wall-clock DATETIME (TypeORM connection timezone +00:00). */
  @CreateDateColumn({ type: 'datetime' })
  changed_at: Date;
}

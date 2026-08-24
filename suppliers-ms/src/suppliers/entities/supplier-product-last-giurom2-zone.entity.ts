import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Ultima gestiune giurom 2.0 aleasă pentru un produs de furnizor, pe o locație client.
 *
 * Preferință de UI: la următoarea comandă pe aceeași locație, selectorul se precompletează
 * cu această valoare dacă gestiunea e încă în catalogul locației. Nu mișcă stoc în App1.
 */
@Entity('supplier_product_last_giurom2_zones')
@Unique('UQ_last_zone_company_loc_product', [
  'company_id',
  'location_id',
  'supplier_product_id',
])
@Index('IDX_last_zone_location', ['company_id', 'location_id'])
export class SupplierProductLastGiurom2Zone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  company_id: number;

  @Column({ type: 'int' })
  location_id: number;

  @Column({ type: 'int' })
  supplier_product_id: number;

  /** `storage_zones.id` din giurom 2.0. */
  @Column({ type: 'int' })
  giurom2_zone_id: number;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

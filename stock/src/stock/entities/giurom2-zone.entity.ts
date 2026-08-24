import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';

/**
 * Catalogul de gestiuni al unei locații legate de giurom 2.0, ținut local.
 *
 * Cache, nu apel live: formularul de comandă trebuie să funcționeze și când App2 e
 * indisponibil, iar numele gestiunii trebuie să rămână stabil pentru comanda deja tipărită.
 * Rândurile există doar pentru locațiile legate — o locație fără legătură nu are gestiuni,
 * deci selectorul nici nu apare.
 */
@Entity('giurom2_zones')
@Unique('UQ_giurom2_zones_location_zone', ['company_id', 'location_id', 'external_zone_id'])
@Index('IDX_giurom2_zones_location', ['company_id', 'location_id'])
export class Giurom2Zone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  company_id: number;

  @Column({ type: 'int' })
  location_id: number;

  /** `storage_zones.id` din giurom 2.0 — valoarea trimisă înapoi ca `zone_ref`. */
  @Column({ type: 'int' })
  external_zone_id: number;

  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code?: string | null;

  /** Gestiunea pe care cade marfa fără alegere explicită. */
  @Column({ type: 'tinyint', default: 0 })
  is_default: number;

  @Column({ type: 'datetime' })
  synced_at: Date;
}

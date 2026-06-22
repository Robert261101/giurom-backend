import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Metadate nomenclator specifice unei locații (când același product_id e folosit în mai multe locații). */
@Entity('product_location_overrides')
@Index('uq_product_location_override', ['product_id', 'location_key'], {
  unique: true,
})
export class ProductLocationOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  product_id: number;

  @Column({ type: 'int', nullable: true })
  location_id?: number | null;

  @Column({ type: 'int' })
  location_key: number;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  name?: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  unit?: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  sku?: string | null;

  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  description?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  photo?: string | null;

  @Column({ type: 'boolean', nullable: true })
  is_consumable?: boolean | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

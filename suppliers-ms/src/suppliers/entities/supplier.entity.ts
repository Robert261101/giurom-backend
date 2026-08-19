import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SupplierFolder } from './supplier-folder.entity';
import { SupplierProduct } from './supplier-product.entity';
import { SupplierOrder } from './supplier-order.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  supplier_name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  registration_number: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  vat_number: string;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  address: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  city: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  region: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  country: string;

  @Column({ type: 'varchar', length: 20 })
  postal_code: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  contact_person: string;

  /** Cod CAEN al firmei (opțional). Păstrat pe suppliers pentru furnizori fără company tenant. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  activity_code: string | null;

  /** Denumire sediu / locație principală (nu creează locație în locations-ms). */
  @Column({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  headquarters_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 34, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  bank_account_number: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Furnizor tenant company id (companies-ms); null for suppliers not owned by a furnizor company. */
  @Column({ type: 'int', nullable: true })
  owner_company_id: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @OneToMany(() => SupplierFolder, (folder) => folder.supplier)
  folders: SupplierFolder[];

  @OneToMany(() => SupplierProduct, (product) => product.supplier)
  products: SupplierProduct[];

  @OneToMany(() => SupplierOrder, (order) => order.supplier)
  orders: SupplierOrder[];

  @OneToMany('SupplierLocations', 'supplier')
  locations: any[];

  /** Calculated (not persisted): supplier has authenticatable furnizor login. */
  has_supplier_account?: boolean;
}



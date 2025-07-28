import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { SupplierFolder } from './supplier-folder.entity';
import { SupplierProduct } from './supplier-product.entity';
import { SupplierOrder } from './supplier-order.entity';

@Entity('suppliers')
export class Supplier {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Numele furnizorului', example: 'SC Alimentara SRL' })
  @Column({ type: 'varchar', length: 200, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  supplier_name: string;

  @ApiProperty({ description: 'Numărul de înregistrare', example: 'J40/12345/2020' })
  @Column({ type: 'varchar', length: 50, unique: true })
  registration_number: string;

  @ApiProperty({ description: 'Codul fiscal', example: 'RO12345678' })
  @Column({ type: 'varchar', length: 20, unique: true })
  vat_number: string;

  @ApiProperty({ description: 'Adresa', example: 'Str. Principală nr. 123' })
  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  address: string;

  @ApiProperty({ description: 'Orașul', example: 'București' })
  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  city: string;

  @ApiProperty({ description: 'Regiunea/Județul', example: 'Ilfov' })
  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  region: string;

  @ApiProperty({ description: 'Țara', example: 'România' })
  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  country: string;

  @ApiProperty({ description: 'Codul poștal', example: '123456' })
  @Column({ type: 'varchar', length: 20 })
  postal_code: string;

  @ApiProperty({ description: 'Numărul de telefon', example: '+40123456789' })
  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @ApiProperty({ description: 'Adresa de email', example: 'contact@alimentara.ro' })
  @Column({ type: 'varchar', length: 150 })
  email: string;

  @ApiProperty({ description: 'Persoana de contact', example: 'Ion Popescu' })
  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  contact_person: string;

  @ApiProperty({ description: 'Furnizorul este activ', example: true })
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @OneToMany(() => SupplierFolder, (folder) => folder.supplier)
  folders: SupplierFolder[];

  @OneToMany(() => SupplierProduct, (product) => product.supplier)
  products: SupplierProduct[];

  @OneToMany(() => SupplierOrder, (order) => order.supplier)
  orders: SupplierOrder[];
}
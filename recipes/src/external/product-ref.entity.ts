import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Lightweight read-only mirror for products table, to allow joins without importing across packages
@Entity('products')
export class ProductRef {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'varchar', length: 150 })
	name: string;

	@Column({ type: 'varchar', length: 50 })
	unit: string;
}



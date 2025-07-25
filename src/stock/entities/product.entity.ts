import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Stock } from './stock.entity';


@Entity('products')
export class Product {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Numele produsului', example: 'Făină', maxLength: 150 })
  @Column({ type: 'varchar', length: 150, unique: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  name: string;

  @ApiProperty({ description: 'Unitatea de măsură', example: 'kg', maxLength: 50 })
  @Column({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  unit: string;

  @ApiProperty({ description: 'Descrierea produsului', example: 'Făină albă de grâu tip 000', required: false })
  @Column({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description?: string;

  @ApiProperty({ description: 'Nivelul minim de stoc', example: 10.5, required: false })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  min_stock_level?: number;

  @ApiProperty({ description: 'Produsul este activ', example: true })
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @OneToMany(() => Stock, (stock) => stock.product)
  stocks: Stock[];



  @OneToMany('RecipeProduct', 'product')
  recipe_products: any[];
} 
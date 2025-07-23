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
import { RecipeUsage } from './recipe-usage.entity';

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

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @OneToMany(() => Stock, (stock) => stock.product)
  stocks: Stock[];

  @OneToMany(() => RecipeUsage, (usage) => usage.product)
  recipe_usages: RecipeUsage[];

  @OneToMany('RecipeProduct', 'product')
  recipe_products: any[];
} 
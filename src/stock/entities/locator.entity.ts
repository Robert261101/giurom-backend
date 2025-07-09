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

@Entity('locators')
export class Locator {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Denumirea locatorului', example: 'Raft A1', maxLength: 150 })
  @Column({ type: 'varchar', length: 150, unique: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  name: string;

  @ApiProperty({ description: 'Locația fizică', example: 'Depozit Central', maxLength: 150 })
  @Column({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  location: string;

  @ApiProperty({ description: 'Furnizor asociat', example: 'Metro', maxLength: 150, required: false })
  @Column({ type: 'varchar', length: 150, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  supplier?: string;

  @ApiProperty({ description: 'Preț unitar sugerat', example: 12.5, required: false })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unit_price?: number;

  @ApiProperty({ description: 'Ultima actualizare', example: '2024-06-01T10:00:00Z', required: false })
  @Column({ type: 'datetime', nullable: true })
  last_update?: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @OneToMany(() => Stock, (stock) => stock.locator)
  stocks: Stock[];
} 
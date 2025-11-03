import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Supplier } from './supplier.entity';

// Eliminat WorkLocation local pentru a evita FK către alt microserviciu

@Entity('supplier_locations')
export class SupplierLocations {
  @ApiProperty({
    description: 'ID-ul unic al asocierii',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul furnizorului',
    example: 1,
  })
  @Column()
  supplier_id: number;

  @ApiProperty({
    description: 'ID-ul locației',
    example: 2,
  })
  @Column()
  id_location: number;

  @ApiProperty({
    description: 'Data creării asocierii',
    example: '2023-12-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ApiProperty({
    description: 'Furnizorul asociat',
    type: () => Supplier,
  })
  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
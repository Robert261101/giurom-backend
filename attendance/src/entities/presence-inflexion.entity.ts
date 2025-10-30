import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Presence } from './presence.entity';

export enum InflexionType {
  EXIT = 'exit',
  ENTRY = 'entry',
}

@Entity('presence_inflexion')
export class PresenceInflexion {
  @ApiProperty({
    description: 'ID-ul unic al punctului de inflexiune',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul prezenței',
    example: 1,
  })
  @Column()
  presence_id: number;

  @ApiProperty({
    description: 'Timestamp-ul punctului de inflexiune',
    example: '2024-01-15T12:00:00Z',
  })
  @Column({ type: 'datetime' })
  timestamp: Date;

  @ApiProperty({
    description: 'Tipul punctului de inflexiune',
    enum: InflexionType,
    example: InflexionType.EXIT,
  })
  @Column({
    type: 'enum',
    enum: InflexionType,
  })
  type: InflexionType;

  @ApiProperty({
    description: 'Latitudinea GPS la punctul de inflexiune',
    example: 44.4268,
    required: false,
  })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  gps_lat: number;

  @ApiProperty({
    description: 'Longitudinea GPS la punctul de inflexiune',
    example: 26.1025,
    required: false,
  })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  gps_lng: number;

  @ApiProperty({
    description: 'Descrierea locației la punctul de inflexiune',
    example: 'Ieșire pentru masa de prânz',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  location_description: string;

  @ApiProperty({
    description: 'Note despre punctul de inflexiune',
    example: 'Ieșire aprobată de manager pentru întâlnire de lucru',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  notes: string;

  // Relații
  @ApiProperty({
    description: 'Prezența pentru acest punct de inflexiune',
    type: () => Presence,
  })
  @ManyToOne(() => Presence, (presence) => presence.inflexions, { 
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'presence_id' })
  presence: Presence;
}
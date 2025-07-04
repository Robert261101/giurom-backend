import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Shift } from './shift.entity';
import { PresenceInflexion } from './presence-inflexion.entity';

export enum PresenceStatus {
  PRESENT_FULL = 'present_full',
  PRESENT_PARTIAL = 'present_partial',
  ABSENT = 'absent',
}

@Entity('presence')
export class Presence {
  @ApiProperty({
    description: 'ID-ul unic al prezenței',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul schimbului de lucru',
    example: 1,
  })
  @Column()
  shift_id: number;

  @ApiProperty({
    description: 'Data pentru care se înregistrează prezența',
    example: '2024-01-15',
  })
  @Column({ type: 'date' })
  date: Date;

  @ApiProperty({
    description: 'Statusul prezenței angajatului',
    enum: PresenceStatus,
    example: PresenceStatus.PRESENT_FULL,
  })
  @Column({
    type: 'enum',
    enum: PresenceStatus,
    default: PresenceStatus.PRESENT_FULL,
  })
  status: PresenceStatus;

  @ApiProperty({
    description: 'Ora de check-in',
    example: '2024-01-15T08:00:00Z',
    required: false,
  })
  @Column({ type: 'datetime', nullable: true })
  check_in: Date;

  @ApiProperty({
    description: 'Ora de check-out',
    example: '2024-01-15T16:00:00Z',
    required: false,
  })
  @Column({ type: 'datetime', nullable: true })
  check_out: Date;

  @ApiProperty({
    description: 'Totalul orelor lucrate',
    example: 8.5,
    required: false,
  })
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  total_hours: number;

  @ApiProperty({
    description: 'Flag GPS pentru ieșirea din zona permisă',
    example: false,
    required: false,
  })
  @Column({ type: 'boolean', default: false })
  gps_exit_flag: boolean;

  @ApiProperty({
    description: 'Note despre prezența angajatului',
    example: 'A ieșit mai devreme din motive medicale',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  notes: string;

  @ApiProperty({
    description: 'Data când a fost creată înregistrarea',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data când a fost actualizată înregistrarea',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Schimbul de lucru pentru această prezență',
    type: () => Shift,
  })
  @ManyToOne(() => Shift, (shift) => shift.presences, { 
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @ApiProperty({
    description: 'Punctele de inflexiune pentru această prezență',
    type: () => [PresenceInflexion],
  })
  @OneToMany(() => PresenceInflexion, (inflexion) => inflexion.presence, {
    cascade: true,
    eager: false,
  })
  inflexions: PresenceInflexion[];
} 
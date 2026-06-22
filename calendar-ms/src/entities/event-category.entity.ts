import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CalendarEvent } from './calendar-event.entity';

@Entity('event_category')
export class EventCategory {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Cod stabil categorie', example: 'work', maxLength: 50 })
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  code: string;

  @ApiProperty({ description: 'Nume afișat', example: 'Work', maxLength: 100 })
  @Column({
    type: 'varchar',
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  name: string;

  @ApiProperty({ description: 'Categorie activă în UI', example: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => CalendarEvent, (event) => event.categoryEntity)
  events: CalendarEvent[];

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

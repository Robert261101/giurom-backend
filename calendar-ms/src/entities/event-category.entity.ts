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

  @ApiProperty({ 
    description: 'Numele categoriei', 
    example: 'Personal',
    maxLength: 100 
  })
  @Column({ 
    type: 'varchar', 
    length: 100,
    unique: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  name: string;

  @ApiProperty({ 
    description: 'Culoarea asociată categoriei (pentru UI)', 
    example: 'purple',
    maxLength: 50,
    required: false
  })
  @Column({ 
    type: 'varchar', 
    length: 50,
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  color?: string;

  @ApiProperty({ 
    description: 'Descrierea categoriei', 
    example: 'Evenimente personale',
    maxLength: 255,
    required: false 
  })
  @Column({ 
    type: 'varchar', 
    length: 255,
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  description?: string;

  @OneToMany(() => CalendarEvent, event => event.category)
  events: CalendarEvent[];

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
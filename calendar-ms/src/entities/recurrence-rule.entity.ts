import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CalendarEvent } from './calendar-event.entity';

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

@Entity('recurrence_rules')
export class RecurrenceRule {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ 
    description: 'Frecvența recurenței', 
    enum: RecurrenceFrequency, 
    example: RecurrenceFrequency.WEEKLY 
  })
  @Column({ type: 'enum', enum: RecurrenceFrequency })
  frequency: RecurrenceFrequency;

  @ApiProperty({ 
    description: 'Intervalul de recurență (ex: la fiecare 2 săptămâni)', 
    example: 1 
  })
  @Column({ type: 'int', default: 1 })
  interval: number;

  @ApiProperty({ 
    description: 'Data și ora de început a recurenței', 
    example: '2024-07-25T09:00:00Z' 
  })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit a recurenței', 
    example: '2024-12-31T23:59:59Z',
    required: false 
  })
  @Column({ type: 'datetime', nullable: true })
  end_datetime?: Date;

  @ApiProperty({ 
    description: 'Zilele recurenței (ex: "Mon,Wed,Fri" pentru săptămânal)', 
    example: 'Mon,Wed,Fri',
    required: false 
  })
  @Column({ 
    type: 'text', 
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  recurrence_days?: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @OneToMany(() => CalendarEvent, (event) => event.recurrence_rule)
  events: CalendarEvent[];
}
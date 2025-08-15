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
import { RecurrenceRule } from './recurrence-rule.entity';

@Entity('calendar_events')
export class CalendarEvent {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ 
    description: 'Titlul evenimentului', 
    example: 'Ședință echipă',
    maxLength: 100 
  })
  @Column({ 
    type: 'varchar', 
    length: 100,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  title: string;

  @ApiProperty({ 
    description: 'Categoria evenimentului', 
    example: 'Întâlniri',
    maxLength: 100 
  })
  @Column({ 
    type: 'varchar', 
    length: 100,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  category: string;

  @ApiProperty({ 
    description: 'Data și ora de început', 
    example: '2024-07-25T09:00:00Z' 
  })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ 
    description: 'Data și ora de sfârșit', 
    example: '2024-07-25T10:00:00Z' 
  })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({ 
    description: 'Durata în minute', 
    example: 60 
  })
  @Column({ type: 'int' })
  duration: number;

  @ApiProperty({ 
    description: 'Descrierea evenimentului', 
    example: 'Discutăm despre progresul proiectelor și planurile pentru săptămâna viitoare',
    required: false 
  })
  @Column({ 
    type: 'text', 
    nullable: true,
    charset: 'utf8mb4', 
    collation: 'utf8mb4_unicode_ci' 
  })
  description?: string;

  @ApiProperty({ 
    description: 'ID regula de recurență', 
    example: 1,
    required: false 
  })
  @Column({ nullable: true })
  recurrence_id?: number;

  @ApiProperty({ 
    description: 'ID angajat care a creat evenimentul', 
    example: 1 
  })
  @Column()
  created_by: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => RecurrenceRule, (rule) => rule.events, { 
    onDelete: 'SET NULL',
    nullable: true 
  })
  @JoinColumn({ name: 'recurrence_id' })
  recurrence_rule?: RecurrenceRule;

  // Intenționat fără relație pentru a evita dependența pe schema employees din acest MS
}



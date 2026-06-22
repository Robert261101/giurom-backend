import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EventCategory } from './event-category.entity';
import { CalendarEventParticipant } from './calendar-event-participant.entity';

export type CalendarEventType = 'general' | 'meeting';
export type CalendarEventStatus = 'active' | 'cancelled';

@Entity('calendar_event')
export class CalendarEvent {
  @ApiProperty({ description: 'ID unic', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID companie tenant', example: 2 })
  @Column({ name: 'company_id', type: 'int' })
  company_id: number;

  @ApiProperty({ description: 'ID locație (NULL dacă is_company_wide)', example: 2, required: false })
  @Column({ name: 'location_id', type: 'int', nullable: true })
  location_id: number | null;

  @ApiProperty({ description: 'ID angajat creator (JWT.sub)', example: 5 })
  @Column({ name: 'created_by_employee_id', type: 'int' })
  created_by_employee_id: number;

  @ApiProperty({ description: 'ID categorie eveniment', example: 2 })
  @Column({ name: 'category_id', type: 'int' })
  category_id: number;

  @ManyToOne(() => EventCategory, { eager: true, nullable: false })
  @JoinColumn({ name: 'category_id' })
  categoryEntity: EventCategory;

  @ApiProperty({
    description: 'Tip eveniment: general sau meeting (cu participanți / RSVP)',
    example: 'general',
    enum: ['general', 'meeting'],
  })
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: ['general', 'meeting'],
    default: 'general',
  })
  event_type: CalendarEventType;

  @ApiProperty({ description: 'Titlul evenimentului', example: 'Ședință echipă', maxLength: 200 })
  @Column({
    type: 'varchar',
    length: 200,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  title: string;

  @ApiProperty({ description: 'Descriere', required: false })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  description: string | null;

  @ApiProperty({ description: 'Data și ora de început', example: '2024-07-25T09:00:00Z' })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({ description: 'Data și ora de sfârșit', example: '2024-07-25T10:00:00Z' })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({ description: 'Eveniment pe toată ziua', example: false })
  @Column({ name: 'all_day', type: 'boolean', default: false })
  all_day: boolean;

  @ApiProperty({
    description: 'Eveniment la nivel de companie (location_id trebuie să fie NULL)',
    example: false,
  })
  @Column({ name: 'is_company_wide', type: 'boolean', default: false })
  is_company_wide: boolean;

  @ApiProperty({ description: 'Stare eveniment', enum: ['active', 'cancelled'], example: 'active' })
  @Column({
    type: 'enum',
    enum: ['active', 'cancelled'],
    default: 'active',
  })
  status: CalendarEventStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @OneToMany(() => CalendarEventParticipant, (participant) => participant.event)
  participants?: CalendarEventParticipant[];
}

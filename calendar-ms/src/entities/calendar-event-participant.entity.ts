import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CalendarEvent } from './calendar-event.entity';

export type CalendarEventParticipantResponse = 'pending' | 'accepted' | 'declined';

@Entity('calendar_event_participant')
export class CalendarEventParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_id', type: 'int' })
  event_id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employee_id: number;

  @ApiProperty({ enum: ['pending', 'accepted', 'declined'], example: 'pending' })
  @Column({
    name: 'response_status',
    type: 'enum',
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  })
  response_status: CalendarEventParticipantResponse;

  @Column({ name: 'responded_at', type: 'datetime', nullable: true })
  responded_at: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => CalendarEvent, (event) => event.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event?: CalendarEvent;
}

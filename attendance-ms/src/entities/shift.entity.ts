import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Presence } from './presence.entity';

@Entity('shifts')
export class Shift {
  @ApiProperty({
    description: 'ID-ul unic al schimbului de lucru',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @Column()
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @Column()
  work_location_id: number;

  @ApiProperty({
    description: 'ID-ul departamentului',
    example: 1,
  })
  @Column()
  department_id: number;

  @ApiProperty({
    description: 'ID-ul poziției în departament',
    example: 1,
  })
  @Column({ nullable: true })
  position_id: number | null;

  @ApiProperty({
    description: 'Data și ora de început a schimbului',
    example: '2024-01-15T08:00:00Z',
  })
  @Column({ type: 'datetime' })
  start_datetime: Date;

  @ApiProperty({
    description: 'Data și ora de sfârșit a schimbului',
    example: '2024-01-15T16:00:00Z',
  })
  @Column({ type: 'datetime' })
  end_datetime: Date;

  @ApiProperty({
    description: 'Note despre schimbul de lucru',
    example: 'Schimb de dimineață cu responsabilități speciale',
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
    description: 'Prezențele înregistrate pentru acest schimb',
    type: () => [Presence],
  })
  @OneToMany(() => Presence, (presence) => presence.shift, {
    cascade: true,
    eager: false,
  })
  presences: Presence[];
}
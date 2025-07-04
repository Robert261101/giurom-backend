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
import { Employee } from '../../employee/entity/employee.entity';
import { WorkLocation } from '../../locations/entity/work-location.entity';
import { WorkLocationDepartments } from '../../locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from '../../locations/entity/work-location-department-positions.entity';
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
  @Column()
  position_id: number;

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
    description: 'Angajatul care lucrează în acest schimb',
    type: () => Employee,
  })
  @ManyToOne(() => Employee, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ApiProperty({
    description: 'Locația de lucru pentru acest schimb',
    type: () => WorkLocation,
  })
  @ManyToOne(() => WorkLocation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'work_location_id' })
  work_location: WorkLocation;

  @ApiProperty({
    description: 'Departamentul pentru acest schimb',
    type: () => WorkLocationDepartments,
  })
  @ManyToOne(() => WorkLocationDepartments, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: WorkLocationDepartments;

  @ApiProperty({
    description: 'Poziția în departament pentru acest schimb',
    type: () => WorkLocationDepartmentPositions,
  })
  @ManyToOne(() => WorkLocationDepartmentPositions, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'position_id' })
  position: WorkLocationDepartmentPositions;

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
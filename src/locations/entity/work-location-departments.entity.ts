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
import { WorkLocation } from './work-location.entity';
import { WorkLocationDepartmentPositions } from './work-location-department-positions.entity';

@Entity('worklocation_departments')
export class WorkLocationDepartments {
  @ApiProperty({
    description: 'ID-ul unic al departamentului locației',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Numele departamentului',
    example: 'Departamentul IT',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  name: string;

  @ApiProperty({
    description: 'Codul departamentului',
    example: 'IT001',
    maxLength: 20,
  })
  @Column({
    type: 'varchar',
    length: 20,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  code: string;

  @ApiProperty({
    description: 'Descrierea departamentului',
    example: 'Departament responsabil pentru infrastructura IT',
    required: false,
  })
  @Column({
    type: 'text',
    nullable: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  description: string;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @Column()
  work_location_id: number;

  @ApiProperty({
    description: 'Data când a fost creată înregistrarea',
    example: '2023-12-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data când a fost actualizată înregistrarea',
    example: '2023-12-15T10:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Locația de lucru la care aparține departamentul',
    type: () => WorkLocation,
  })
  @ManyToOne(() => WorkLocation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'work_location_id' })
  work_location: WorkLocation;

  @ApiProperty({
    description: 'Pozițiile din acest departament',
    type: () => [WorkLocationDepartmentPositions],
  })
  @OneToMany(
    () => WorkLocationDepartmentPositions,
    (position) => position.department,
    {
      cascade: true,
      eager: false,
    },
  )
  positions: WorkLocationDepartmentPositions[];
} 
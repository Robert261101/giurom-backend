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
import { WorkLocationDepartments } from './work-location-departments.entity';

@Entity('worklocation_department_positions')
export class WorkLocationDepartmentPositions {
  @ApiProperty({
    description: 'ID-ul unic al poziției în departament',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Numele poziției',
    example: 'Dezvoltator Software Senior',
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
    description: 'Codul poziției',
    example: 'DEV_SR_001',
    maxLength: 50,
  })
  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  code: string;

  @ApiProperty({
    description: 'Descrierea poziției',
    example: 'Responsabil pentru dezvoltarea aplicațiilor web',
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
    description: 'ID-ul departamentului',
    example: 1,
  })
  @Column()
  department_id: number;

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
    description: 'Departamentul la care aparține poziția',
    type: () => WorkLocationDepartments,
  })
  @ManyToOne(() => WorkLocationDepartments, (department) => department.positions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'department_id' })
  department: WorkLocationDepartments;
} 
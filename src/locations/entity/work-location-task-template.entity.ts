import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WorkLocation } from './work-location.entity';

@Entity('worklocation_tasktemplate')
export class WorkLocationTaskTemplate {
  @ApiProperty({
    description: 'ID-ul unic al relației',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @Column()
  location_id: number;

  @ApiProperty({
    description: 'ID-ul template-ului de sarcină',
    example: 1,
    default: 1,
    required: false,
  })
  @Column({ default: 1 })
  template_id: number;

  @ApiProperty({
    description: 'Data când a fost atribuit template-ul la locație',
    example: '2023-12-15T10:30:00Z',
  })
  @Column({ type: 'datetime', nullable: true })
  assigned_at: Date;

  @ApiProperty({
    description: 'Indică dacă template-ul este activ pentru această locație',
    example: true,
    default: true,
  })
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ApiProperty({
    description: 'Note despre atribuirea template-ului',
    example: 'Template atribuit pentru echipa de dimineață',
  })
  @Column({ type: 'text', nullable: true })
  notes: string;



  // Relații
  @ApiProperty({
    description: 'Locația de lucru asociată',
    type: () => WorkLocation,
  })
  @ManyToOne(() => WorkLocation, (location) => location.task_templates, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'location_id' })
  work_location: WorkLocation;
} 
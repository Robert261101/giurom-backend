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
import { TaskTemplate } from './task-template.entity';

// Local reference to WorkLocation from locations microservice
@Entity('work_location')
export class WorkLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  company_id: number;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  location_name: string;

  @Column({ type: 'text', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  address: string;

  @Column({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  city: string;
}

@Entity('Templates_Locations')
export class TemplatesLocations {
  @ApiProperty({
    description: 'ID-ul unic al asocierii',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul template-ului',
    example: 1,
  })
  @Column({ name: 'task_templates_id' })
  task_templates_id: number;

  @ApiProperty({
    description: 'ID-ul locației',
    example: 2,
  })
  @Column({ name: 'id_location' })
  id_location: number;

  @ApiProperty({
    description: 'Data creării asocierii',
    example: '2023-12-15T10:30:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relations
  @ApiProperty({
    description: 'Template-ul de task asociat',
    type: () => TaskTemplate,
  })
  @ManyToOne(() => TaskTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_templates_id' })
  taskTemplate: TaskTemplate;

  @ApiProperty({
    description: 'Locația asociată',
    type: () => WorkLocation,
  })
  @ManyToOne(() => WorkLocation, { nullable: true })
  @JoinColumn({ name: 'id_location' })
  workLocation?: WorkLocation;
}
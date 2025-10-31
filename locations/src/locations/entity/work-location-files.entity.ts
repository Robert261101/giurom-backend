import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WorkLocation } from './work-location.entity';

@Entity('work_location_files')
export class WorkLocationFiles {
  @ApiProperty({
    description: 'ID-ul unic al fișierului',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul locației',
    example: 1,
  })
  @Column()
  work_location_id: number;

  @ApiProperty({
    description: 'Numele fișierului',
    example: 'Contract_Locatie_1.pdf',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_name: string;

  @ApiProperty({
    description: 'Tipul fișierului',
    example: 'pdf',
    maxLength: 100,
  })
  @Column({
    type: 'varchar',
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_type: string;

  @ApiProperty({
    description: 'Link-ul către fișier',
    example: '/files/locations/1/document.pdf',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  })
  file_link: string;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-15T14:30:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: 'Locația asociată cu acest fișier',
    type: () => WorkLocation,
  })
  @ManyToOne(() => WorkLocation, location => location.location_files)
  @JoinColumn({ name: 'work_location_id' })
  workLocation: WorkLocation;
}

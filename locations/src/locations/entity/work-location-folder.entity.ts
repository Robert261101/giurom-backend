import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkLocation } from './work-location.entity';

@Entity('work_location_folders')
export class WorkLocationFolder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  work_location_id: number;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  description: string;

  @Column({ type: 'varchar', length: 500, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  folder_path: string;

  @Column({ type: 'int', nullable: true })
  parent_id: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => WorkLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_location_id' })
  workLocation: WorkLocation;

  @ManyToOne(() => WorkLocationFolder, (parent) => parent.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: WorkLocationFolder | null;

  @OneToMany(() => WorkLocationFolder, (child) => child.parent)
  children: WorkLocationFolder[];
}

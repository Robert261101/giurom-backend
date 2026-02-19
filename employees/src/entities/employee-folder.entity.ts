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
import { Employee } from './employee.entity';
import { EmployeeFiles } from './employee-files.entity';

@Entity('employee_folders')
export class EmployeeFolder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employee_id: number;

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

  @ManyToOne(() => Employee, (employee: Employee) => (employee as any).folders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => EmployeeFolder, (parent) => parent.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: EmployeeFolder | null;

  @OneToMany(() => EmployeeFolder, (child) => child.parent)
  children: EmployeeFolder[];

  @OneToMany(() => EmployeeFiles, (file) => file.folder)
  documents: EmployeeFiles[];
}

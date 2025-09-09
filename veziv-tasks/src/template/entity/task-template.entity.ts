import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TaskElement, ElementType } from './task-element.entity';

export enum TemplateType {
  EMPLOYEE = 'employee',
  MANAGER = 'manager'
}

@Entity('Task_Templates')
export class TaskTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  template_name: string;

  @Column({
    type: 'enum',
    enum: TemplateType,
    default: TemplateType.EMPLOYEE
  })
  template_type: TemplateType;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TaskElement, element => element.template)
  elements: TaskElement[];

  @OneToMany('TemplatesLocations', 'taskTemplate')
  locations: any[];
} 
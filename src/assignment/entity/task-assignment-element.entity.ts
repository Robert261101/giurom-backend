import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TaskAssignment } from './task-assignment.entity';
import { TaskElement } from '../../template/entity/task-element.entity';

@Entity('Task_Assignment_Elements')
export class TaskAssignmentElement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_assignment_id', type: 'int' })
  task_assignment_id: number;

  @ManyToOne(() => TaskAssignment, assignment => assignment.elements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_assignment_id' })
  task_assignment: TaskAssignment;

  @Column({ name: 'task_element_id', type: 'int' })
  task_element_id: number;

  @ManyToOne(() => TaskElement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_element_id' })
  task_element: TaskElement;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'int', nullable: true })
  score: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
} 
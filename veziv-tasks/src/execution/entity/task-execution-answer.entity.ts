import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TaskExecution } from './task-execution.entity';
import { TaskElement } from '../../template/entity/task-element.entity';

@Entity('Task_Execution_Answers')
@Index(['task_execution_id']) // Index pentru join-uri eficiente
@Index(['task_element_id']) // Index pentru filtrare după element
export class TaskExecutionAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'task_execution_id', type: 'int' })
  task_execution_id: number;

  @ManyToOne(() => TaskExecution, execution => execution.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_execution_id' })
  task_execution: TaskExecution;

  @Column({ name: 'task_element_id', type: 'int' })
  task_element_id: number;

  @ManyToOne(() => TaskElement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_element_id' })
  task_element: TaskElement;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'int', default: 0 })
  score_awarded: number;

  @CreateDateColumn()
  created_at: Date;
} 
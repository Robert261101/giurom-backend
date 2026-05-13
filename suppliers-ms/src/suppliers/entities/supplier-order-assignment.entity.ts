import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupplierOrder } from './supplier-order.entity';

export enum SupplierOrderAssignmentStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

@Entity('supplier_order_assignments')
export class SupplierOrderAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_order_id: number;

  @Column()
  employee_id: number;

  @Column({ type: 'datetime' })
  assigned_at: Date;

  @Column({ nullable: true })
  created_by_user_id?: number;

  @Column({
    type: 'enum',
    enum: SupplierOrderAssignmentStatus,
    default: SupplierOrderAssignmentStatus.ASSIGNED,
  })
  status: SupplierOrderAssignmentStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => SupplierOrder, (order) => order.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_order_id' })
  order: SupplierOrder;
}

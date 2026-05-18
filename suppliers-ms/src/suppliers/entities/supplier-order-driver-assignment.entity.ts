import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { SupplierOrder } from "./supplier-order.entity";

export enum SupplierOrderDriverAssignmentStatus {
  ASSIGNED = "assigned",
  DONE = "done",
}

@Entity("supplier_order_driver_assignments")
export class SupplierOrderDriverAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_order_id: number;

  @Column()
  driver_id: number;

  @Column({ type: "datetime" })
  scheduled_at: Date;

  @Column({ type: "date", nullable: true })
  delivery_date?: Date | null;

  @Column({ type: "int", unsigned: true, nullable: true })
  delivery_priority?: number | null;

  @Column({ nullable: true })
  notes?: string;

  @Column({ type: "enum", enum: SupplierOrderDriverAssignmentStatus, default: SupplierOrderDriverAssignmentStatus.ASSIGNED })
  status: SupplierOrderDriverAssignmentStatus;

  @Column({ nullable: true })
  assigned_by_user_id?: number;

  @CreateDateColumn({ type: "datetime" })
  created_at: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  @ManyToOne(() => SupplierOrder, (order) => order.driverAssignments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supplier_order_id" })
  order: SupplierOrder;
}

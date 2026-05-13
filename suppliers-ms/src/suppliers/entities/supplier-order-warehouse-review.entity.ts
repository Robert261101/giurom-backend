import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  RelationId,
} from "typeorm";
import { SupplierOrder } from "./supplier-order.entity";
import { SupplierOrderItemChange } from "./supplier-order-item-change.entity";

export enum WarehouseReviewStatus {
  DRAFT = "draft",
  SENT_TO_SUPPLIER = "sent_to_supplier",
  APPROVED = "approved",
  REJECTED = "rejected",
  SENT_BACK = "sent_back",
}

@Entity("supplier_order_warehouse_reviews")
export class SupplierOrderWarehouseReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  warehouse_employee_id?: number;

  @Column({ type: "text", nullable: true })
  supplier_feedback?: string;

  @Column({ type: "text", nullable: true })
  warehouse_notes?: string;

  @Column({
    type: "enum",
    enum: WarehouseReviewStatus,
    default: WarehouseReviewStatus.DRAFT,
  })
  status: WarehouseReviewStatus;

  @CreateDateColumn({ type: "datetime" })
  created_at: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  @ManyToOne(() => SupplierOrder, (order) => order.warehouseReviews, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: SupplierOrder;

  @RelationId((review: SupplierOrderWarehouseReview) => review.order)
  order_id: number;

  @OneToMany(() => SupplierOrderItemChange, (change) => change.review)
  itemChanges: SupplierOrderItemChange[];
}

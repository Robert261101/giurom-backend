import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  RelationId,
} from "typeorm";
import { SupplierOrder } from "./supplier-order.entity";
import { SupplierOrderWarehouseReview } from "./supplier-order-warehouse-review.entity";

export enum SupplierOrderItemChangeType {
  UNCHANGED = "unchanged",
  QUANTITY_CHANGED = "quantity_changed",
  PARTIAL_AVAILABLE = "partial_available",
  UNAVAILABLE = "unavailable",
  ADDED_BY_WAREHOUSE = "added_by_warehouse",
  VARIANT_CHANGED = "variant_changed",
  SPLIT_VARIANT = "split_variant",
}

@Entity("supplier_order_item_changes")
export class SupplierOrderItemChange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  original_order_item_id?: number;

  @Column({ nullable: true })
  final_order_item_id?: number;

  @Column({ nullable: true })
  original_product_id?: number;

  @Column({ nullable: true })
  final_product_id?: number;

  @Column({ nullable: true })
  original_variant_id?: number;

  @Column({ nullable: true })
  final_variant_id?: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  original_variant_label?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  final_variant_label?: string;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  original_quantity?: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  final_quantity?: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  original_units?: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  final_units?: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  original_total_weight?: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  final_total_weight?: number;

  @Column({
    type: "enum",
    enum: SupplierOrderItemChangeType,
  })
  change_type: SupplierOrderItemChangeType;

  @Column({ nullable: true })
  changed_by_employee_id?: number;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ type: "datetime" })
  created_at: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  @ManyToOne(() => SupplierOrder, (order) => order.itemChanges, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: SupplierOrder;

  @RelationId((change: SupplierOrderItemChange) => change.order)
  order_id: number;

  @ManyToOne(() => SupplierOrderWarehouseReview, (review) => review.itemChanges, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "review_id" })
  review: SupplierOrderWarehouseReview;

  @RelationId((change: SupplierOrderItemChange) => change.review)
  review_id: number;
}

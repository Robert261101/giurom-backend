import { SupplierOrder } from './supplier-order.entity';
export declare enum ReceptionStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare class SupplierOrderItemReception {
    id: number;
    supplier_order_id: number;
    order: SupplierOrder;
    supplier_order_item_id: number;
    product_id: number;
    received_delta: number;
    returned_delta: number;
    reason?: string;
    user_id?: number;
    location_id?: number;
    occurred_at: Date;
    stock_item_id?: number;
    status: ReceptionStatus;
    created_at: Date;
}

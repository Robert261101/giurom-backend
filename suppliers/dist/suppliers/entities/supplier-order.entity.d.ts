import { Supplier } from './supplier.entity';
import { SupplierOrderItem } from './supplier-order-item.entity';
import { SupplierOrderDocument } from './supplier-order-document.entity';
export declare enum OrderStatus {
    DRAFT = "draft",
    SENT = "sent",
    CONFIRMED = "confirmed",
    CANCELLED = "cancelled",
    DELIVERED = "delivered"
}
export declare class SupplierOrder {
    id: number;
    supplier_id: number;
    order_date: Date;
    delivery_date: Date;
    status: OrderStatus;
    total_amount: number;
    notes?: string;
    created_by_user_id: number;
    created_at: Date;
    updated_at: Date;
    supplier: Supplier;
    items: SupplierOrderItem[];
    documents: SupplierOrderDocument[];
}

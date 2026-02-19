import { SupplierOrder } from './supplier-order.entity';
import { SupplierOrderItem } from './supplier-order-item.entity';
export declare class SupplierOrderCancelledItem {
    id: number;
    order_id: number;
    supplier_order_item_id: number;
    product_id: number;
    quantity: number;
    price_per_unit: number;
    subtotal: number;
    total: number;
    received_quantity: number;
    returned_quantity: number;
    return_reason?: string;
    reception_date: Date;
    reception_user_id: number;
    created_at: Date;
    updated_at: Date;
    order: SupplierOrder;
    orderItem: SupplierOrderItem;
}

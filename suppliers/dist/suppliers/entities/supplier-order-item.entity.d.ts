import { SupplierOrder } from './supplier-order.entity';
export declare class SupplierOrderItem {
    id: number;
    order_id: number;
    product_id: number;
    quantity: number;
    price_per_unit: number;
    subtotal: number;
    created_at: Date;
    updated_at: Date;
    order: SupplierOrder;
}

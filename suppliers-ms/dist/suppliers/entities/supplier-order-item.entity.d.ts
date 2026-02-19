import { SupplierOrder } from './supplier-order.entity';
export declare class SupplierOrderItem {
    id: number;
    order_id: number;
    product_id: number;
    quantity: number;
    price_per_unit: number;
    subtotal: number;
    total: number;
    received_quantity: number;
    reception_date?: Date;
    reception_user_id?: number;
    returned_quantity: number;
    return_reason?: string;
    created_at: Date;
    updated_at: Date;
    order: SupplierOrder;
}

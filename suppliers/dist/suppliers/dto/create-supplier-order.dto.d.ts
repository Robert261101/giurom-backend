import { OrderStatus } from '../entities/supplier-order.entity';
export declare class CreateSupplierOrderItemDto {
    product_id: number;
    quantity: number;
    price_per_unit: number;
}
export declare class CreateSupplierOrderDto {
    supplier_id: number;
    order_date: string;
    delivery_date: string;
    status?: OrderStatus;
    notes?: string;
    created_by_user_id: number;
    items: CreateSupplierOrderItemDto[];
}

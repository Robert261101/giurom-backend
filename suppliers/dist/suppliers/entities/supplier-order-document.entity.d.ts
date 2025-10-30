import { SupplierOrder } from './supplier-order.entity';
export declare class SupplierOrderDocument {
    id: number;
    order_id: number;
    document_type: string;
    file_name: string;
    file_path: string;
    created_at: Date;
    updated_at: Date;
    order: SupplierOrder;
}

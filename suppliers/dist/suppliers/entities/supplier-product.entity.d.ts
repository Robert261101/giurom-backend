import { Supplier } from './supplier.entity';
export declare class SupplierProduct {
    id: number;
    supplier_id: number;
    product_id: number;
    product_name: string;
    product_description?: string;
    unit_of_measure: string;
    price_per_unit: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    supplier: Supplier;
}

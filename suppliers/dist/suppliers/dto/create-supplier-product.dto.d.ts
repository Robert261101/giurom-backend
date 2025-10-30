export declare class CreateSupplierProductDto {
    supplier_id: number;
    product_id: number;
    product_name: string;
    product_description?: string;
    unit_of_measure: string;
    price_per_unit: number;
    is_active?: boolean;
}

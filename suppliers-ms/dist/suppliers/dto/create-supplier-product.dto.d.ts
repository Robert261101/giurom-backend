export declare class CreateSupplierProductDto {
    supplier_id: number;
    product_id: number;
    product_name: string;
    product_description?: string;
    unit_of_measure: string;
    price_per_unit: number;
    vat?: number;
    final_price?: number;
    is_active?: boolean;
}

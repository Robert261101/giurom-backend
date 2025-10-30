import { Product } from './product.entity';
export declare class WasteRecord {
    id: number;
    product_id: number;
    location_id?: number;
    recipe_id: number | null;
    quantity: number;
    unit: string;
    reason: string | null;
    created_at: Date;
    updated_at: Date;
    product: Product;
}

import { Product } from './product.entity';
export declare class Category {
    id: number;
    name: string;
    type: string;
    description?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    products: Product[];
}

import { Product } from './product.entity';
import { StockTransaction } from './stock-transaction.entity';
export declare enum StockStatus {
    VALID = "valid",
    EXPIRED = "expired",
    BELOW_MINIMUM = "below_minimum"
}
export declare class Stock {
    id: number;
    product_id: number;
    location_id?: number;
    supplier_order_item_id?: number;
    quantity: number;
    price: number;
    entry_date: Date;
    expiration_date?: Date;
    last_update?: Date;
    status: StockStatus;
    created_at: Date;
    updated_at: Date;
    product: Product;
    transactions: StockTransaction[];
}

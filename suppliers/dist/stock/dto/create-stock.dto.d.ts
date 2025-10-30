import { StockStatus } from '../entities/stock.entity';
export declare class CreateStockDto {
    product_id: number;
    location_id?: number;
    supplier_order_item_id?: number;
    quantity: number;
    price: number;
    entry_date: Date;
    expiration_date?: Date;
    status?: StockStatus;
}

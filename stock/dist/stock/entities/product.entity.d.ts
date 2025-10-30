import { Stock } from './stock.entity';
import { WasteRecord } from './waste-record.entity';
import { Category } from './category.entity';
export declare class Product {
    id: number;
    name: string;
    unit: string;
    description?: string;
    min_stock_level?: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    stocks: Stock[];
    wasteRecords: WasteRecord[];
    categories: Category[];
}

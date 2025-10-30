import { Stock } from './stock.entity';
export declare enum TransactionType {
    ENTRY = "entry",
    EXIT = "exit"
}
export declare class StockTransaction {
    id: number;
    stock_id: number;
    type: TransactionType;
    quantity: number;
    location: string;
    target?: string;
    timestamp: Date;
    stock: Stock;
}

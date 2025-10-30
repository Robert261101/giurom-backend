import { TransactionType } from '../entities/stock-transaction.entity';
export declare class CreateStockTransactionDto {
    stock_id: number;
    type: TransactionType;
    quantity: number;
    location: string;
    target?: string;
}

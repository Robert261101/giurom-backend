export declare enum TransactionTypeRef {
    ENTRY = "entry",
    EXIT = "exit"
}
export declare class StockTransactionRef {
    id: number;
    stock_id: number;
    type: TransactionTypeRef;
    quantity: number;
    location: string;
    target?: string | null;
    timestamp: Date;
}

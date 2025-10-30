export declare enum StockStatusRef {
    VALID = "valid",
    EXPIRED = "expired",
    BELOW_MINIMUM = "below_minimum"
}
export declare class StockRef {
    id: number;
    product_id: number;
    quantity: number;
    entry_date: Date;
    expiration_date?: Date | null;
    last_update?: Date | null;
    status: StockStatusRef;
}

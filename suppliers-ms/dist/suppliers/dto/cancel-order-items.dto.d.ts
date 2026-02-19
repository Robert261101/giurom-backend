export declare class CancelOrderItemDto {
    itemId: number;
    returnedQuantity: number;
    returnReason?: string;
}
export declare class CancelOrderItemsDto {
    orderId: number;
    items: CancelOrderItemDto[];
}

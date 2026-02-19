export declare class PartialReceptionItemDto {
    itemId: number;
    receivedQuantity: number;
    returnedQuantity?: number;
    returnReason?: string;
}
export declare class PartialReceptionDto {
    orderId: number;
    items: PartialReceptionItemDto[];
}

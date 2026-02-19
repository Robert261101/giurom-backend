export declare class ApproveReceptionDto {
    orderId: number;
    receptionIds: number[];
}
export declare class RejectReceptionDto {
    orderId: number;
    receptionIds: number[];
    reason?: string;
}

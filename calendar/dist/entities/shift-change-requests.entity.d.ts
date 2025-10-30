export declare enum ShiftChangeStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare class ShiftChangeRequests {
    id: number;
    employee_id: number;
    replacement_id: number;
    start_datetime: Date;
    end_datetime: Date;
    comment?: string;
    status: ShiftChangeStatus;
    reviewed_by_id: number;
    reviewed_at: Date;
    created_at: Date;
    updated_at: Date;
}

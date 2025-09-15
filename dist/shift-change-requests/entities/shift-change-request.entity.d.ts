export declare enum DurationUnit {
    DAYS = "days",
    HOURS = "hours"
}
export declare enum ShiftChangeStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare class ShiftChangeRequest {
    id: number;
    employee_id: number;
    replacement_id: number;
    start_datetime: Date;
    end_datetime: Date;
    duration_unit: 'days' | 'hours';
    comment?: string;
    status: ShiftChangeStatus;
    reviewed_by_id?: number;
    reviewed_at?: Date;
    created_at: Date;
    updated_at: Date;
    get duration_in_days(): number;
    get duration_in_hours(): number;
    get shift_date(): string;
}

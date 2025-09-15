export declare enum DurationUnit {
    DAYS = "days",
    HOURS = "hours"
}
export declare enum LeaveStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare class LeaveRequest {
    id: number;
    employee_id: number;
    leave_type: string;
    start_datetime: Date;
    end_datetime: Date;
    comment?: string;
    duration_unit: DurationUnit;
    status: LeaveStatus;
    reviewed_by_id?: number;
    reviewed_at?: Date;
    created_at: Date;
    updated_at: Date;
    get duration_in_days(): number;
    get duration_in_hours(): number;
}

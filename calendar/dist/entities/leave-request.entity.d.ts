export declare enum LeaveRequestStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare enum LeaveType {
    DAYS = "days",
    HOURS = "hours"
}
export declare enum DurationUnit {
    DAYS = "days",
    HOURS = "hours"
}
export declare class LeaveRequest {
    id: number;
    employee_id: number;
    leave_type: string;
    start_datetime: Date;
    end_datetime: Date;
    comment?: string;
    duration_unit: DurationUnit;
    status: LeaveRequestStatus;
    created_at: Date;
    updated_at: Date;
    reviewed_by_id: number;
    reviewed_at: Date;
}

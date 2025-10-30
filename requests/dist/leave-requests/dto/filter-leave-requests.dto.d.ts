import { LeaveStatus, DurationUnit } from '../entities/leave-request.entity';
export declare class FilterLeaveRequestsDto {
    status?: LeaveStatus;
    employee_id?: number;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    reviewed_by_id?: number;
    duration_unit?: DurationUnit;
}

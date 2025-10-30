import { DurationUnit } from '../entities/leave-request.entity';
export declare class CreateLeaveRequestDto {
    employee_id: number;
    leave_type: string;
    start_datetime: string;
    end_datetime: string;
    comment?: string;
    duration_unit?: DurationUnit;
}

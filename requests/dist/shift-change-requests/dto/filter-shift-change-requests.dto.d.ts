import { ShiftChangeStatus } from '../entities/shift-change-request.entity';
export declare class FilterShiftChangeRequestsDto {
    status?: ShiftChangeStatus;
    employee_id?: number;
    replacement_id?: number;
    start_date?: string;
    end_date?: string;
    reviewed_by_id?: number;
}

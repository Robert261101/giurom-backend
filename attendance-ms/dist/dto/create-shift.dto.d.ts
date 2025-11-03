export declare class CreateShiftDto {
    employee_id: number;
    work_location_id: number;
    department_id: number;
    position_id?: number;
    start_datetime: string;
    end_datetime: string;
    notes?: string;
}

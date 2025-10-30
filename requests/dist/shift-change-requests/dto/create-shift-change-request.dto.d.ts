export declare class CreateShiftChangeRequestDto {
    employee_id: number;
    replacement_id: number;
    start_datetime: string;
    end_datetime: string;
    comment?: string;
    duration_unit?: 'days' | 'hours';
}

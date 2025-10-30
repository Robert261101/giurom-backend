import { Presence } from './presence.entity';
export declare class Shift {
    id: number;
    employee_id: number;
    work_location_id: number;
    department_id: number;
    position_id: number | null;
    start_datetime: Date;
    end_datetime: Date;
    notes: string;
    created_at: Date;
    updated_at: Date;
    presences: Presence[];
}

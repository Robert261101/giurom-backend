export declare class CalendarEvent {
    id: number;
    title: string;
    category: string;
    start_datetime: Date;
    end_datetime: Date;
    duration: number;
    description?: string;
    recurrence_id?: number;
    created_at: Date;
    updated_at: Date;
    created_by: number;
}

import { CalendarEvent } from './calendar-event.entity';
export declare enum RecurrenceFrequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    CUSTOM = "custom"
}
export declare class RecurrenceRule {
    id: number;
    frequency: RecurrenceFrequency;
    interval: number;
    start_datetime: Date;
    end_datetime?: Date;
    recurrence_days?: string;
    events: CalendarEvent[];
}

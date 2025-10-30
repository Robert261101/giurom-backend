import { RecurrenceRule } from './recurrence-rule.entity';
import { Employee } from '../../employee/entity/employee.entity';
export declare class CalendarEvent {
    id: number;
    title: string;
    category: string;
    start_datetime: Date;
    end_datetime: Date;
    duration: number;
    description?: string;
    recurrence_id?: number;
    created_by: number;
    created_at: Date;
    updated_at: Date;
    recurrence_rule?: RecurrenceRule;
    creator: Employee;
}

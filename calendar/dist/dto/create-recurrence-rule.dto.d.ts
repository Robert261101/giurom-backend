import { RecurrenceFrequency } from '../entities/recurrence-rule.entity';
export declare class CreateRecurrenceRuleDto {
    frequency: RecurrenceFrequency;
    interval: number;
    start_datetime: string;
    end_datetime?: string;
    recurrence_days?: string;
}

import { Repository } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
export declare class CalendarService {
    private readonly eventRepo;
    private readonly recurrenceRepo;
    constructor(eventRepo: Repository<CalendarEvent>, recurrenceRepo: Repository<RecurrenceRule>);
    createRecurrenceRule(dto: CreateRecurrenceRuleDto): Promise<RecurrenceRule>;
    createEvent(dto: CreateCalendarEventDto, currentUserId?: number): Promise<CalendarEvent>;
    findEvents(filters: FilterCalendarEventsDto, currentUserId?: number): Promise<CalendarEvent[]>;
    findOne(id: number, currentUserId?: number): Promise<CalendarEvent>;
    updateEvent(id: number, dto: UpdateCalendarEventDto, currentUserId?: number): Promise<CalendarEvent>;
    removeEvent(id: number, currentUserId?: number): Promise<void>;
    findAllRecurrenceRules(): Promise<RecurrenceRule[]>;
    findRecurrenceRule(id: number): Promise<RecurrenceRule>;
    generateRecurringEvents(recurrenceRuleId: number, startDate: Date, endDate: Date): Promise<Partial<CalendarEvent>[]>;
    updateRecurrenceEndDate(eventId: number, endDateIso: string, currentUserId?: number): Promise<{
        success: true;
    }>;
    private matchesRecurrenceRule;
    private getNextRecurrenceDate;
}

import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
export declare class CalendarController {
    private readonly calendarService;
    constructor(calendarService: CalendarService);
    createRecurrenceRule(createRecurrenceRuleDto: CreateRecurrenceRuleDto): Promise<RecurrenceRule>;
    findAllRecurrenceRules(): Promise<RecurrenceRule[]>;
    findRecurrenceRule(id: number): Promise<RecurrenceRule>;
    createEvent(body: CreateCalendarEventDto | {
        event: CreateCalendarEventDto;
        recurrenceSettings?: any;
    }, currentUserId?: string): Promise<CalendarEvent>;
    findEvents(filters: FilterCalendarEventsDto, currentUserId?: string): Promise<CalendarEvent[]>;
    findOne(id: number, currentUserId?: string): Promise<CalendarEvent>;
    updateEvent(id: number, updateCalendarEventDto: UpdateCalendarEventDto, currentUserId?: string): Promise<CalendarEvent>;
    updateRecurrenceEndDate(id: number, endDate: string, currentUserId?: string): Promise<{
        success: true;
    }>;
    removeEvent(id: number, currentUserId?: string): Promise<void>;
    generateRecurringEvents(id: number, startDate: string, endDate: string): Promise<Partial<CalendarEvent>[]>;
}

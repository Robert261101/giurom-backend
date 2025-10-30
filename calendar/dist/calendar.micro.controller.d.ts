import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
export declare class CalendarMicroController {
    private readonly service;
    constructor(service: CalendarService);
    createRecurrence(dto: CreateRecurrenceRuleDto): Promise<import("./entities/recurrence-rule.entity").RecurrenceRule>;
    createEvent(payload: {
        dto: CreateCalendarEventDto;
        currentUserId?: number;
    }): Promise<import("./entities/calendar-event.entity").CalendarEvent>;
    findEvents(payload: {
        filters: FilterCalendarEventsDto;
        currentUserId?: number;
    }): Promise<import("./entities/calendar-event.entity").CalendarEvent[]>;
    updateEvent(payload: {
        id: number;
        dto: UpdateCalendarEventDto;
        currentUserId?: number;
    }): Promise<import("./entities/calendar-event.entity").CalendarEvent>;
    deleteEvent(payload: {
        id: number;
        currentUserId?: number;
    }): Promise<void>;
    findOne(payload: {
        id: number;
        currentUserId?: number;
    }): Promise<import("./entities/calendar-event.entity").CalendarEvent>;
    generateRecurrence(payload: {
        recurrenceRuleId: number;
        startDate: string;
        endDate: string;
    }): Promise<Partial<import("./entities/calendar-event.entity").CalendarEvent>[]>;
}

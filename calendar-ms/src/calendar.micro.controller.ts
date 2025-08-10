import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CalendarService } from '@/calendar/calendar.service';
import { CreateCalendarEventDto } from '@/calendar/dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from '@/calendar/dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from '@/calendar/dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from '@/calendar/dto/filter-calendar-events.dto';

@Controller()
export class CalendarMicroController {
  constructor(private readonly service: CalendarService) {}

  @MessagePattern('calendar.recurrence.create')
  createRecurrence(@Payload() dto: CreateRecurrenceRuleDto) {
    return this.service.createRecurrenceRule(dto);
  }

  @MessagePattern('calendar.events.create')
  createEvent(@Payload() payload: { dto: CreateCalendarEventDto; currentUserId?: number }) {
    return this.service.createEvent(payload.dto, payload.currentUserId);
  }

  @MessagePattern('calendar.events.find')
  findEvents(@Payload() payload: { filters: FilterCalendarEventsDto; currentUserId?: number }) {
    return this.service.findEvents(payload.filters, payload.currentUserId);
  }

  @MessagePattern('calendar.events.update')
  updateEvent(@Payload() payload: { id: number; dto: UpdateCalendarEventDto; currentUserId?: number }) {
    return this.service.updateEvent(payload.id, payload.dto, payload.currentUserId);
  }
}



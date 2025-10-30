import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';

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

  @MessagePattern('calendar.events.delete')
  deleteEvent(@Payload() payload: { id: number; currentUserId?: number }) {
    return this.service.removeEvent(payload.id, payload.currentUserId);
  }

  @MessagePattern('calendar.events.findOne')
  findOne(@Payload() payload: { id: number; currentUserId?: number }) {
    return this.service.findOne(payload.id, payload.currentUserId);
  }

  @MessagePattern('calendar.recurrence.generate')
  generateRecurrence(@Payload() payload: { recurrenceRuleId: number; startDate: string; endDate: string }) {
    return this.service.generateRecurringEvents(
      payload.recurrenceRuleId,
      new Date(payload.startDate),
      new Date(payload.endDate),
    );
  }


}



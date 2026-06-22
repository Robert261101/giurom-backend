import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
import { CalendarJwtUser } from './calendar-access';

@Controller()
export class CalendarMicroController {
  constructor(private readonly service: CalendarService) {}

  @MessagePattern('calendar.events.create')
  createEvent(
    @Payload() payload: { dto: CreateCalendarEventDto; user?: CalendarJwtUser },
  ) {
    return this.service.createEvent(payload.dto, payload.user);
  }

  @MessagePattern('calendar.events.find')
  findEvents(
    @Payload() payload: {
      filters: FilterCalendarEventsDto;
      user?: CalendarJwtUser;
      authorization?: string;
    },
  ) {
    return this.service.findEvents(
      payload.filters,
      payload.user,
      payload.authorization,
    );
  }

  @MessagePattern('calendar.events.update')
  updateEvent(
    @Payload() payload: {
      id: number;
      dto: UpdateCalendarEventDto;
      user?: CalendarJwtUser;
      authorization?: string;
    },
  ) {
    return this.service.updateEvent(
      payload.id,
      payload.dto,
      payload.user,
      payload.authorization,
    );
  }

  @MessagePattern('calendar.events.delete')
  deleteEvent(
    @Payload() payload: { id: number; user?: CalendarJwtUser; authorization?: string },
  ) {
    return this.service.removeEvent(
      payload.id,
      payload.user,
      payload.authorization,
    );
  }

  @MessagePattern('calendar.events.findOne')
  findOne(
    @Payload() payload: { id: number; user?: CalendarJwtUser; authorization?: string },
  ) {
    return this.service.findOne(payload.id, payload.user, payload.authorization);
  }
}

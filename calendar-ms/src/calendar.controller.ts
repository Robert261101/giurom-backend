import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { AuthOnly, Permissions } from './permissions/permissions.decorator';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
import { RespondCalendarEventDto } from './dto/respond-calendar-event.dto';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarEventParticipant } from './entities/calendar-event-participant.entity';
import { EventCategory } from './entities/event-category.entity';
import { Request } from 'express';
import { CalendarJwtUser } from './calendar-access';
import { PlanFeatureGuard, RequiresPlanFeature } from './plan-access/plan-access.nest';

@ApiTags('calendar')
@Controller('calendar')
@ApiBearerAuth()
// Subscription gate (after RBAC): calendar events require the "evenimente" feature.
@RequiresPlanFeature('evenimente')
@UseGuards(PlanFeatureGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  private getUser(req: Request): CalendarJwtUser {
    return req['user'] as CalendarJwtUser;
  }

  private getAuthorization(req: Request): string | undefined {
    const header = req.headers.authorization;
    return typeof header === 'string' ? header : undefined;
  }

  @Post('events')
  @Permissions('calendar.create')
  @ApiOperation({ summary: 'Creează un eveniment în calendar (v1, fără recurență)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: CalendarEvent,
  })
  createEvent(
    @Body() body: CreateCalendarEventDto,
    @Req() req: Request,
  ): Promise<CalendarEvent> {
    return this.calendarService.createEvent(body, this.getUser(req));
  }

  @Get('events')
  @AuthOnly()
  @ApiOperation({ summary: 'Listează evenimente cu scope JWT' })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiQuery({ name: 'category_id', required: false })
  @ApiQuery({ name: 'category_code', required: false })
  @ApiQuery({ name: 'created_by_employee_id', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'location_id', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'cancelled', 'all'] })
  @ApiResponse({ status: HttpStatus.OK, type: [CalendarEvent] })
  findEvents(
    @Query() filters: FilterCalendarEventsDto,
    @Req() req: Request,
  ): Promise<CalendarEvent[]> {
    return this.calendarService.findEvents(
      filters,
      this.getUser(req),
      this.getAuthorization(req),
    );
  }

  @Get('categories')
  @AuthOnly()
  @ApiOperation({ summary: 'Categorii active (citire pentru orice utilizator autentificat)' })
  @ApiResponse({ status: HttpStatus.OK, type: [EventCategory] })
  findEventCategories(): Promise<EventCategory[]> {
    return this.calendarService.getEventCategories();
  }

  @Get('events/:id')
  @AuthOnly()
  @ApiOperation({ summary: 'Detaliu eveniment cu același scope ca lista' })
  @ApiParam({ name: 'id', description: 'ID eveniment' })
  @ApiResponse({ status: HttpStatus.OK, type: CalendarEvent })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<CalendarEvent> {
    return this.calendarService.findOne(
      id,
      this.getUser(req),
      this.getAuthorization(req),
    );
  }

  @Post('events/:id/respond')
  @AuthOnly()
  @ApiOperation({ summary: 'Răspuns RSVP — doar meeting, employee_id din JWT.sub' })
  @ApiParam({ name: 'id', description: 'ID eveniment' })
  @ApiResponse({ status: HttpStatus.OK, type: CalendarEventParticipant })
  respondToInvitation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondCalendarEventDto,
    @Req() req: Request,
  ): Promise<CalendarEventParticipant> {
    return this.calendarService.respondToInvitation(id, dto, this.getUser(req));
  }

  @Patch('events/:id')
  @Permissions('calendar.update')
  @ApiOperation({ summary: 'Actualizează eveniment' })
  @ApiParam({ name: 'id', description: 'ID eveniment' })
  @ApiResponse({ status: HttpStatus.OK, type: CalendarEvent })
  updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCalendarEventDto: UpdateCalendarEventDto,
    @Req() req: Request,
  ): Promise<CalendarEvent> {
    return this.calendarService.updateEvent(
      id,
      updateCalendarEventDto,
      this.getUser(req),
      this.getAuthorization(req),
    );
  }

  @Delete('events/:id')
  @Permissions('calendar.delete')
  @ApiOperation({ summary: 'Șterge eveniment' })
  @ApiParam({ name: 'id', description: 'ID eveniment' })
  removeEvent(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<void> {
    return this.calendarService.removeEvent(
      id,
      this.getUser(req),
      this.getAuthorization(req),
    );
  }
}

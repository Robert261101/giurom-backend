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
  Headers,
  Req,
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
import { Permissions } from './permissions/permissions.decorator';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { EventCategory } from './entities/event-category.entity';
import { Request } from 'express';

@ApiTags('calendar')
@Controller('calendar')
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // POST /calendar/recurrence-rules – creare regulă recurență
  @Post('recurrence-rules')
  @Permissions('calendar.create')
  @ApiOperation({ summary: 'Creează o regulă de recurență pentru evenimente' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Regula de recurență a fost creată cu succes',
    type: RecurrenceRule,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru regula de recurență',
  })
  createRecurrenceRule(@Body() createRecurrenceRuleDto: CreateRecurrenceRuleDto): Promise<RecurrenceRule> {
    return this.calendarService.createRecurrenceRule(createRecurrenceRuleDto);
  }

  // GET /calendar/recurrence-rules – listare reguli de recurență
  @Get('recurrence-rules')
  @Permissions('calendar.read')
  @ApiOperation({ summary: 'Obține toate regulile de recurență' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista regulilor de recurență',
    type: [RecurrenceRule],
  })
  findAllRecurrenceRules(): Promise<RecurrenceRule[]> {
    return this.calendarService.findAllRecurrenceRules();
  }

  // GET /calendar/recurrence-rules/:id – obținere regulă specifică
  @Get('recurrence-rules/:id')
  @Permissions('calendar.read')
  @ApiOperation({ summary: 'Obține o regulă de recurență specifică' })
  @ApiParam({ name: 'id', description: 'ID-ul regulii de recurență' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Regula de recurență găsită',
    type: RecurrenceRule,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Regula de recurență nu a fost găsită',
  })
  findRecurrenceRule(@Param('id', ParseIntPipe) id: number): Promise<RecurrenceRule> {
    return this.calendarService.findRecurrenceRule(id);
  }

  // POST /calendar/events – creare eveniment
  @Post('events')
  @Permissions('calendar.create')
  @ApiOperation({ summary: 'Creează un eveniment în calendar' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Evenimentul a fost creat cu succes',
    type: CalendarEvent,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru eveniment',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul creator sau regula de recurență nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să creezi evenimente pentru alți utilizatori',
  })
  createEvent(
    @Body() body: CreateCalendarEventDto | { event: CreateCalendarEventDto; recurrenceSettings?: any },
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    
    // Handle both direct event data and wrapped event data for backward compatibility
    const createCalendarEventDto = 'event' in body ? body.event : body;
    
    return this.calendarService.createEvent(createCalendarEventDto, userId);
  }

  // GET /calendar/events – listare evenimente (filtrare opțională)
  @Get('events')
  @Permissions('calendar.read')
  @ApiOperation({ summary: 'Obține evenimente din calendar cu filtrare opțională' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Data de început pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'Data de sfârșit pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'category', required: false, description: 'Categoria evenimentelor' })
  @ApiQuery({ name: 'created_by', required: false, description: 'ID-ul creatorului evenimentelor' })
  @ApiQuery({ name: 'search', required: false, description: 'Căutare în titlu sau descriere' })
  @ApiQuery({ name: 'location_id', required: false, description: 'Filtrare după locație – doar evenimente ale acestei locații' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista evenimentelor filtrate',
    type: [CalendarEvent],
  })
  findEvents(
    @Query() filters: FilterCalendarEventsDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.findEvents(filters, userId);
  }

  // GET /calendar/categories – obținere toate categoriile
  @Get('categories')
  @Permissions('calendar.read')
  @ApiOperation({ summary: 'Obține toate categoriile de evenimente' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista categoriilor de evenimente',
    type: [EventCategory],
  })
  findEventCategories(@Req() request: Request): Promise<EventCategory[]> {
    console.log('🔍 CalendarController.findEventCategories called');
    console.log('🔍 Request user:', request['user']);
    return this.calendarService.getEventCategories();
  }

  // GET /calendar/events/:id – obținere eveniment specific
  @Get('events/:id')
  @Permissions('calendar.read')
  @ApiOperation({ summary: 'Obține detaliile unui eveniment specific' })
  @ApiParam({ name: 'id', description: 'ID-ul evenimentului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evenimentul găsit',
    type: CalendarEvent,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Evenimentul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să vezi acest eveniment',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.findOne(id, userId);
  }

  // PATCH /calendar/events/:id – modificare eveniment
  @Patch('events/:id')
  @Permissions('calendar.update')
  @ApiOperation({ summary: 'Modifică un eveniment din calendar' })
  @ApiParam({ name: 'id', description: 'ID-ul evenimentului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evenimentul a fost modificat cu succes',
    type: CalendarEvent,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Evenimentul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să modifici acest eveniment',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru actualizare',
  })
  updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCalendarEventDto: UpdateCalendarEventDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.updateEvent(id, updateCalendarEventDto, userId);
  }

  // PATCH /calendar/events/:id/recurrence-end-date – oprește recurența începând cu o dată
  @Patch('events/:id/recurrence-end-date')
  @Permissions('calendar.update')
  @ApiOperation({ summary: 'Oprește recurența pentru evenimentul de bază începând cu o dată' })
  @ApiParam({ name: 'id', description: 'ID-ul evenimentului de bază' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Recurența a fost oprită' })
  updateRecurrenceEndDate(
    @Param('id', ParseIntPipe) id: number,
    @Body('endDate') endDate: string,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<{ success: true }> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.updateRecurrenceEndDate(id, endDate, userId);
  }

  // DELETE /calendar/events/:id – ștergere eveniment
  @Delete('events/:id')
  @Permissions('calendar.delete')
  @ApiOperation({ summary: 'Șterge un eveniment din calendar' })
  @ApiParam({ name: 'id', description: 'ID-ul evenimentului' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Evenimentul a fost șters cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Evenimentul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să ștergi acest eveniment',
  })
  removeEvent(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<void> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.removeEvent(id, userId);
  }

  // GET /calendar/recurrence-rules/:id/generate-events – generare evenimente recurente
  @Get('recurrence-rules/:id/generate-events')
  @Permissions('calendar.read')
  @ApiOperation({ summary: 'Generează evenimente pe baza unei reguli de recurență' })
  @ApiParam({ name: 'id', description: 'ID-ul regulii de recurență' })
  @ApiQuery({ name: 'start_date', description: 'Data de început pentru generare (ISO format)' })
  @ApiQuery({ name: 'end_date', description: 'Data de sfârșit pentru generare (ISO format)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evenimente generate pe baza regulii de recurență',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Regula de recurență nu a fost găsită',
  })
  generateRecurringEvents(
    @Param('id', ParseIntPipe) id: number,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ): Promise<Partial<CalendarEvent>[]> {
    return this.calendarService.generateRecurringEvents(
      id,
      new Date(startDate),
      new Date(endDate)
    );
  }

  // exceptions endpoint removed to keep schema stable
}
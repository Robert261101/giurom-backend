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
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';

@ApiTags('calendar')
@Controller('calendar')
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // Endpoint pentru crearea regulilor de recurență
  @Post('recurrence-rule')
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

  @Get('recurrence-rules')
  @ApiOperation({ summary: 'Obține toate regulile de recurență' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista regulilor de recurență',
    type: [RecurrenceRule],
  })
  findAllRecurrenceRules(): Promise<RecurrenceRule[]> {
    return this.calendarService.findAllRecurrenceRules();
  }

  @Get('recurrence-rule/:id')
  @ApiOperation({ summary: 'Obține o regulă de recurență specifică' })
  @ApiParam({ name: 'id', description: 'ID-ul regulii de recurență' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detaliile regulii de recurență',
    type: RecurrenceRule,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Regula de recurență nu a fost găsită',
  })
  findRecurrenceRule(@Param('id', ParseIntPipe) id: number): Promise<RecurrenceRule> {
    return this.calendarService.findRecurrenceRule(id);
  }

  // Endpoint pentru crearea evenimentelor
  @Post('event')
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
    @Body() createCalendarEventDto: CreateCalendarEventDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.createEvent(createCalendarEventDto, userId);
  }

  // Endpoint pentru listarea evenimentelor cu filtrare
  @Get('events')
  @ApiOperation({ summary: 'Obține evenimente din calendar cu filtrare opțională' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Data de început pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'Data de sfârșit pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'category', required: false, description: 'Categoria evenimentelor' })
  @ApiQuery({ name: 'created_by', required: false, description: 'ID-ul creatorului evenimentelor' })
  @ApiQuery({ name: 'search', required: false, description: 'Căutare în titlu sau descriere' })
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

  @Get('event/:id')
  @ApiOperation({ summary: 'Obține detaliile unui eveniment specific' })
  @ApiParam({ name: 'id', description: 'ID-ul evenimentului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detaliile evenimentului',
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

  // Endpoint pentru modificarea evenimentelor
  @Patch('event/:id')
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

  @Delete('event/:id')
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

  // Endpoint pentru generarea evenimentelor recurente (helper pentru frontend)
  @Get('recurrence-rule/:id/generate-events')
  @ApiOperation({ summary: 'Generează evenimente pe baza unei reguli de recurență' })
  @ApiParam({ name: 'id', description: 'ID-ul regulii de recurență' })
  @ApiQuery({ name: 'start_date', required: true, description: 'Data de început pentru generare (ISO format)' })
  @ApiQuery({ name: 'end_date', required: true, description: 'Data de sfârșit pentru generare (ISO format)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista evenimentelor generate pe baza regulii de recurență',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_datetime: { type: 'string', format: 'date-time' },
        },
      },
    },
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

  // Endpoint pentru obținerea evenimentelor unei anumite categorii
  @Get('events/category/:category')
  @ApiOperation({ summary: 'Obține evenimente dintr-o anumită categorie' })
  @ApiParam({ name: 'category', description: 'Categoria evenimentelor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista evenimentelor din categoria specificată',
    type: [CalendarEvent],
  })
  findEventsByCategory(
    @Param('category') category: string,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.findEvents({ category }, userId);
  }

  // Endpoint pentru obținerea evenimentelor unui anumit creator
  @Get('events/creator/:creatorId')
  @ApiOperation({ summary: 'Obține evenimente create de un anumit utilizator' })
  @ApiParam({ name: 'creatorId', description: 'ID-ul creatorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista evenimentelor create de utilizatorul specificat',
    type: [CalendarEvent],
  })
  findEventsByCreator(
    @Param('creatorId', ParseIntPipe) creatorId: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.findEvents({ created_by: creatorId }, userId);
  }
}

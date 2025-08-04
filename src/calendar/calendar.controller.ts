import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
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

  // POST /recurrence-rule – creare regulă recurență
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

  // POST /calendar-event – creare eveniment
  @Post('calendar-event')
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
    @Body() body: { event: CreateCalendarEventDto; recurrenceSettings?: any },
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.createEvent(body.event, userId, body.recurrenceSettings);
  }

  // GET /calendar-events – listare evenimente (filtrare opțională)
  @Get('calendar-events')
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

  // PATCH /calendar-event/:id – modificare eveniment
  @Patch('calendar-event/:id')
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

  // ===== ENDPOINT-URI SUPLIMENTARE COMENTATE =====
  // Acestea pot fi decomentate dacă sunt necesare în viitor

  @Get('recurrence-rules')
  @ApiOperation({ summary: 'Obține toate regulile de recurență' })
  findAllRecurrenceRules(): Promise<RecurrenceRule[]> {
    return this.calendarService.findAllRecurrenceRules();
  }

  @Get('recurrence-rule/:id')
  @ApiOperation({ summary: 'Obține o regulă de recurență specifică' })
  findRecurrenceRule(@Param('id', ParseIntPipe) id: number): Promise<RecurrenceRule> {
    return this.calendarService.findRecurrenceRule(id);
  }

  @Get('event/:id')
  @ApiOperation({ summary: 'Obține detaliile unui eveniment specific' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<CalendarEvent> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.findOne(id, userId);
  }

  @Delete('event/:id')
  @ApiOperation({ summary: 'Șterge un eveniment din calendar' })
  removeEvent(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<void> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.calendarService.removeEvent(id, userId);
  }

  @Get('recurrence-rule/:id/generate-events')
  @ApiOperation({ summary: 'Generează evenimente pe baza unei reguli de recurență' })
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
}

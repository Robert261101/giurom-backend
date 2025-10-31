import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Repository, Between, Like } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule, RecurrenceFrequency } from './entities/recurrence-rule.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(RecurrenceRule)
    private readonly recurrenceRepo: Repository<RecurrenceRule>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  private async sendCalendarNotification(
    type: string,
    title: string,
    description: string,
    entity_id?: number,
    metadata?: any
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'calendar.notification' }, {
          type,
          title,
          description,
          entity_id,
          entity_type: 'calendar_event',
          metadata,
          priority: 'medium',
        })
      );
    } catch (error) {
      console.error('Failed to send calendar notification:', error);
    }
  }

  // Creare regulă de recurență
  async createRecurrenceRule(dto: CreateRecurrenceRuleDto): Promise<RecurrenceRule> {
    // Validări suplimentare
    const startDate = new Date(dto.start_datetime);
    const endDate = dto.end_datetime ? new Date(dto.end_datetime) : null;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
    }

    // Validare zile recurență pentru frecvența săptămânală
    if (dto.frequency === RecurrenceFrequency.WEEKLY && !dto.recurrence_days) {
      throw new BadRequestException('Pentru frecvența săptămânală, zilele recurenței sunt obligatorii');
    }

    const recurrenceRule = this.recurrenceRepo.create({
      ...dto,
      start_datetime: startDate,
      end_datetime: endDate,
    });

    return this.recurrenceRepo.save(recurrenceRule);
  }

  // Creare eveniment calendar
  async createEvent(dto: CreateCalendarEventDto, currentUserId?: number): Promise<CalendarEvent> {
    // Validări pentru date
    const startDate = new Date(dto.start_datetime);
    const endDate = new Date(dto.end_datetime);

    if (endDate <= startDate) {
      throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
    }

    // Calculează durata automată dacă nu este specificată corect
    const calculatedDuration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    if (Math.abs(dto.duration - calculatedDuration) > 1) {
      // Permite o diferență de 1 minut pentru rotunjiri
      throw new BadRequestException('Durata specificată nu corespunde cu diferența dintre start și end');
    }

    // Verifică dacă regula de recurență există (dacă este specificată)
    if (dto.recurrence_id) {
      const recurrenceRule = await this.recurrenceRepo.findOne({ where: { id: dto.recurrence_id } });
      if (!recurrenceRule) {
        throw new NotFoundException('Regula de recurență nu a fost găsită');
      }
    }

    const event = this.eventRepo.create({
      ...dto,
      start_datetime: startDate,
      end_datetime: endDate,
    });

    const savedEvent = await this.eventRepo.save(event);
    
    // Send notification to admin and manager that a new event was created
    await this.sendCalendarNotification(
      'calendar_event_created',
      'Eveniment nou creat',
      `A fost creat un nou eveniment în calendar: ${savedEvent.title}`,
      savedEvent.id,
      {
        eventId: savedEvent.id,
        title: savedEvent.title,
        startDatetime: savedEvent.start_datetime,
        createdBy: savedEvent.created_by,
      }
    );

    return savedEvent;
  }

  // Listare evenimente cu filtrare
  async findEvents(filters: FilterCalendarEventsDto, currentUserId?: number): Promise<CalendarEvent[]> {
    const queryBuilder = this.eventRepo.createQueryBuilder('event');

    // Filtrare pe baza datelor
    if (filters.start_date && filters.end_date) {
      queryBuilder.andWhere('event.start_datetime BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.start_date),
        endDate: new Date(filters.end_date),
      });
    } else if (filters.start_date) {
      queryBuilder.andWhere('event.start_datetime >= :startDate', {
        startDate: new Date(filters.start_date),
      });
    } else if (filters.end_date) {
      queryBuilder.andWhere('event.start_datetime <= :endDate', {
        endDate: new Date(filters.end_date),
      });
    }

    // Filtrare pe categorie
    if (filters.category) {
      queryBuilder.andWhere('event.category = :category', { category: filters.category });
    }

    // Filtrare pe creator
    if (filters.created_by) {
      queryBuilder.andWhere('event.created_by = :createdBy', { createdBy: filters.created_by });
    }

    // Căutare în titlu sau descriere
    if (filters.search) {
      queryBuilder.andWhere(
        '(event.title LIKE :search OR event.description LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Autorizare: utilizatorii pot vedea doar propriile evenimente
    if (currentUserId) {
      queryBuilder.andWhere('event.created_by = :currentUserId', { currentUserId });
    }

    queryBuilder.orderBy('event.start_datetime', 'ASC');

    return queryBuilder.getMany();
  }

  // Obținere eveniment specific
  async findOne(id: number, currentUserId?: number): Promise<CalendarEvent> {
    const event = await this.eventRepo.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Evenimentul nu a fost găsit');
    }

    // Autorizare: doar creatorul poate vedea evenimentul
    if (currentUserId && event.created_by !== currentUserId) {
      throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
    }

    return event;
  }

  // Actualizare eveniment
  async updateEvent(id: number, dto: UpdateCalendarEventDto, currentUserId?: number): Promise<CalendarEvent> {
    const event = await this.findOne(id, currentUserId);

    // Autorizare: doar creatorul poate modifica evenimentul
    if (currentUserId && event.created_by !== currentUserId) {
      throw new ForbiddenException('Nu ai permisiunea să modifici acest eveniment');
    }

    // Validări pentru date dacă sunt actualizate
    if (dto.start_datetime || dto.end_datetime) {
      const startDate = dto.start_datetime ? new Date(dto.start_datetime) : event.start_datetime;
      const endDate = dto.end_datetime ? new Date(dto.end_datetime) : event.end_datetime;

      if (endDate <= startDate) {
        throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
      }

      // Actualizează durata dacă datele se schimbă
      if (dto.start_datetime || dto.end_datetime) {
        const calculatedDuration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
        dto.duration = calculatedDuration;
      }
    }

    // Verifică regula de recurență dacă este actualizată
    if (dto.recurrence_id) {
      const recurrenceRule = await this.recurrenceRepo.findOne({ where: { id: dto.recurrence_id } });
      if (!recurrenceRule) {
        throw new NotFoundException('Regula de recurență nu a fost găsită');
      }
    }

    // Actualizează evenimentul
    Object.assign(event, {
      ...dto,
      start_datetime: dto.start_datetime ? new Date(dto.start_datetime) : event.start_datetime,
      end_datetime: dto.end_datetime ? new Date(dto.end_datetime) : event.end_datetime,
    });

    return this.eventRepo.save(event);
  }

  // Ștergere eveniment
  async removeEvent(id: number, currentUserId?: number): Promise<void> {
    const event = await this.findOne(id, currentUserId);

    // Autorizare: doar creatorul poate șterge evenimentul
    if (currentUserId && event.created_by !== currentUserId) {
      throw new ForbiddenException('Nu ai permisiunea să ștergi acest eveniment');
    }

    await this.eventRepo.remove(event);
  }

  // Obținere toate regulile de recurență
  async findAllRecurrenceRules(): Promise<RecurrenceRule[]> {
    return this.recurrenceRepo.find({
      order: { id: 'DESC' },
    });
  }

  // Obținere regulă de recurență specifică
  async findRecurrenceRule(id: number): Promise<RecurrenceRule> {
    const rule = await this.recurrenceRepo.findOne({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Regula de recurență nu a fost găsită');
    }

    return rule;
  }

  // Generare evenimente recurente (helper pentru afișare)
  async generateRecurringEvents(
    recurrenceRuleId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Partial<CalendarEvent>[]> {
    const rule = await this.findRecurrenceRule(recurrenceRuleId);
    const events: Partial<CalendarEvent>[] = [];

    // Implementare simplificată pentru generarea evenimentelor recurente
    let currentDate = new Date(Math.max(rule.start_datetime.getTime(), startDate.getTime()));
    const ruleEndDate = rule.end_datetime || endDate;

    const exceptionSet = new Set<string>();
    while (currentDate <= ruleEndDate && currentDate <= endDate) {
      // Verifică dacă ziua curentă se potrivește cu regula
      if (this.matchesRecurrenceRule(currentDate, rule)) {
        const isoDate = currentDate.toISOString().split('T')[0];
        if (!exceptionSet.has(isoDate)) {
          events.push({
            title: `Eveniment recurent (${rule.frequency})`,
            start_datetime: new Date(currentDate),
            // Alte proprietăți pot fi completate pe baza template-ului
          });
        }
      }

      // Avansează data pe baza frecvenței
      currentDate = this.getNextRecurrenceDate(currentDate, rule);
    }

    return events;
  }

  async updateRecurrenceEndDate(eventId: number, endDateIso: string, currentUserId?: number): Promise<{ success: true }> {
    const event = await this.findOne(eventId, currentUserId);
    if (event.recurrence_id) {
      const rule = await this.recurrenceRepo.findOne({ where: { id: event.recurrence_id } });
      if (!rule) throw new NotFoundException('Regula de recurență nu a fost găsită');
      const endDate = new Date(endDateIso);
      if (isNaN(endDate.getTime())) throw new BadRequestException('Data de sfârșit recurență invalidă');
      if (rule.start_datetime && endDate <= rule.start_datetime) {
        throw new BadRequestException('Data de sfârșit recurență trebuie să fie după data de început');
      }
      rule.end_datetime = endDate;
      await this.recurrenceRepo.save(rule);
      return { success: true };
    }
    throw new BadRequestException('Evenimentul nu are recurență asociată');
  }

  // updateRecurrenceExceptions removed to avoid schema mismatch

  private matchesRecurrenceRule(date: Date, rule: RecurrenceRule): boolean {
    if (rule.frequency === RecurrenceFrequency.WEEKLY && rule.recurrence_days) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = dayNames[date.getDay()];
      return rule.recurrence_days.split(',').includes(currentDay);
    }

    return true; // Pentru alte frecvențe, implementare simplificată
  }

  private getNextRecurrenceDate(currentDate: Date, rule: RecurrenceRule): Date {
    const nextDate = new Date(currentDate);

    switch (rule.frequency) {
      case RecurrenceFrequency.DAILY:
        nextDate.setDate(nextDate.getDate() + rule.interval);
        break;
      case RecurrenceFrequency.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 1); // Verifică ziua următoare
        break;
      case RecurrenceFrequency.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + rule.interval);
        break;
      default:
        nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }
}
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule, RecurrenceFrequency } from './entities/recurrence-rule.entity';
import { Employee } from '../employee/entity/employee.entity';
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
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

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

  // Creare eveniment calendar cu suport pentru recurrence
  async createEvent(dto: CreateCalendarEventDto, currentUserId?: number, recurrenceSettings?: any): Promise<CalendarEvent> {
    // Verifică dacă angajatul creator există
    const creator = await this.employeeRepo.findOne({ where: { id: dto.created_by } });
    if (!creator) {
      throw new NotFoundException('Angajatul creator nu a fost găsit');
    }

    // Autorizare: doar creatorul poate crea evenimente pentru sine
    if (currentUserId && currentUserId !== dto.created_by) {
      throw new ForbiddenException('Nu poți crea evenimente pentru alți utilizatori');
    }

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

    // Creează regula de recurență dacă este specificată
    let recurrenceRuleId = dto.recurrence_id;
    if (recurrenceSettings && recurrenceSettings.enabled) {
      const recurrenceRule = await this.createRecurrenceFromSettings(recurrenceSettings, startDate);
      recurrenceRuleId = recurrenceRule.id;
    }

    // Verifică dacă regula de recurență există (dacă este specificată)
    if (recurrenceRuleId) {
      const recurrenceRule = await this.recurrenceRepo.findOne({ where: { id: recurrenceRuleId } });
      if (!recurrenceRule) {
        throw new NotFoundException('Regula de recurență nu a fost găsită');
      }
    }

    const event = this.eventRepo.create({
      ...dto,
      recurrence_id: recurrenceRuleId,
      start_datetime: startDate,
      end_datetime: endDate,
    });

    return this.eventRepo.save(event);
  }

  // Helper pentru crearea regulii de recurență din setările frontend-ului
  private async createRecurrenceFromSettings(settings: any, baseDate: Date): Promise<RecurrenceRule> {
    // Pentru yearly, folosim CUSTOM frequency deoarece YEARLY nu există în enum
    let frequency = settings.frequency as RecurrenceFrequency;
    if (settings.frequency === 'yearly') {
      frequency = RecurrenceFrequency.CUSTOM;
      // Adaugă flag pentru yearly în times
      settings.times = { ...settings.times, yearly: true };
    }

    // Creează datetime string fără conversie UTC pentru a păstra timezone-ul local
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const hours = String(baseDate.getHours()).padStart(2, '0');
    const minutes = String(baseDate.getMinutes()).padStart(2, '0');
    const seconds = String(baseDate.getSeconds()).padStart(2, '0');
    const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;

    const recurrenceData: CreateRecurrenceRuleDto = {
      frequency: frequency,
      interval: 1,
      start_datetime: localDateTime,
      end_datetime: undefined, // Poate fi setat mai târziu
      recurrence_days: JSON.stringify(settings.times) // Stochează orele per zi ca JSON
    };

    return this.createRecurrenceRule(recurrenceData);
  }

  // Listare evenimente cu filtrare (include evenimente recurente generate)
  async findEvents(filters: FilterCalendarEventsDto, currentUserId?: number): Promise<CalendarEvent[]> {
    const queryBuilder = this.eventRepo.createQueryBuilder('event')
      .leftJoinAndSelect('event.recurrence_rule', 'recurrence')
      .leftJoinAndSelect('event.creator', 'creator');

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

    const regularEvents = await queryBuilder.getMany();

    // Generează evenimente recurente pentru perioada specificată
    let recurringEvents: CalendarEvent[] = [];
    if (filters.start_date && filters.end_date) {
      recurringEvents = await this.generateRecurringEventsForCalendar(
        new Date(filters.start_date),
        new Date(filters.end_date)
      );

      // Aplică filtrele și pe evenimentele recurente
      recurringEvents = recurringEvents.filter(event => {
        if (filters.category && event.category !== filters.category) return false;
        if (filters.created_by && event.created_by !== filters.created_by) return false;
        if (currentUserId && event.created_by !== currentUserId) return false;
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (!event.title.toLowerCase().includes(searchLower) && 
              !event.description?.toLowerCase().includes(searchLower)) return false;
        }
        return true;
      });
    }

    // Combină evenimentele regulate cu cele recurente și sortează
    const allEvents = [...regularEvents, ...recurringEvents];
    return allEvents.sort((a, b) => a.start_datetime.getTime() - b.start_datetime.getTime());
  }

  // Obținere eveniment specific
  async findOne(id: number, currentUserId?: number): Promise<CalendarEvent> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['recurrence_rule', 'creator'],
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
      relations: ['events'],
      order: { id: 'DESC' },
    });
  }

  // Obținere regulă de recurență specifică
  async findRecurrenceRule(id: number): Promise<RecurrenceRule> {
    const rule = await this.recurrenceRepo.findOne({
      where: { id },
      relations: ['events'],
    });

    if (!rule) {
      throw new NotFoundException('Regula de recurență nu a fost găsită');
    }

    return rule;
  }

  // Generare evenimente recurente pentru afișare în calendar
  async generateRecurringEventsForCalendar(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    // Obține toate evenimentele cu reguli de recurență
    const recurringEvents = await this.eventRepo.createQueryBuilder('event')
      .leftJoinAndSelect('event.recurrence_rule', 'recurrence')
      .leftJoinAndSelect('event.creator', 'creator')
      .where('event.recurrence_id IS NOT NULL')
      .getMany();

    const generatedEvents: CalendarEvent[] = [];

    for (const baseEvent of recurringEvents) {
      if (!baseEvent.recurrence_rule) continue;

      const rule = baseEvent.recurrence_rule;
      const recurrenceTimes = this.parseRecurrenceDays(rule.recurrence_days);

      // Generează evenimente pe baza regulii
      const events = this.generateEventsFromRule(baseEvent, rule, recurrenceTimes, startDate, endDate);
      generatedEvents.push(...events);
    }

    return generatedEvents;
  }

  // Parsează zilele și orele din JSON
  private parseRecurrenceDays(recurrenceDays: string | null): { [key: string]: string } {
    if (!recurrenceDays) return {};
    
    try {
      return JSON.parse(recurrenceDays);
    } catch {
      // Fallback pentru format vechi "Mon,Wed,Fri"
      const days = recurrenceDays.split(',');
      const result: { [key: string]: string } = {};
      days.forEach(day => {
        result[day.toLowerCase()] = '09:00'; // Ora default
      });
      return result;
    }
  }

  // Generează evenimente pe baza regulii și orelor specifice
  private generateEventsFromRule(
    baseEvent: CalendarEvent,
    rule: RecurrenceRule,
    recurrenceTimes: { [key: string]: string },
    startDate: Date,
    endDate: Date
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    // Data evenimentului original pentru a evita duplicarea
    const originalEventDate = new Date(baseEvent.start_datetime);
    const originalDateStr = originalEventDate.toISOString().split('T')[0];

    if (rule.frequency === RecurrenceFrequency.DAILY || rule.frequency === RecurrenceFrequency.WEEKLY) {
      return this.generateDailyWeeklyEvents(baseEvent, rule, recurrenceTimes, startDate, endDate, originalDateStr);
    } else if (rule.frequency === RecurrenceFrequency.MONTHLY) {
      return this.generateMonthlyEvents(baseEvent, rule, recurrenceTimes, startDate, endDate, originalDateStr);
    } else if (rule.frequency === RecurrenceFrequency.CUSTOM && (recurrenceTimes['yearly'] || recurrenceTimes['yearly-time'])) {
      return this.generateYearlyEvents(baseEvent, rule, recurrenceTimes, startDate, endDate, originalDateStr);
    }

    return events;
  }

  // Generare evenimente zilnice/săptămânale
  private generateDailyWeeklyEvents(
    baseEvent: CalendarEvent,
    rule: RecurrenceRule,
    recurrenceTimes: { [key: string]: string },
    startDate: Date,
    endDate: Date,
    originalDateStr: string
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const dayMapping = {
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };

    let currentDate = new Date(Math.max(rule.start_datetime.getTime(), startDate.getTime()));
    const ruleEndDate = rule.end_datetime || endDate;

    while (currentDate <= ruleEndDate && currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      // Skip dacă este aceeași zi cu evenimentul original pentru a evita duplicarea
      if (currentDateStr === originalDateStr) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const dayKey = Object.keys(dayMapping).find(key => dayMapping[key] === currentDate.getDay());
      
      // Pentru daily, verifică dacă ziua este în lista de zile selectate
      // Pentru weekly, verifică dacă există oră setată pentru ziua respectivă
      const shouldGenerateEvent = rule.frequency === RecurrenceFrequency.DAILY ? 
        dayKey : // Pentru daily, generează pentru toate zilele
        (dayKey && recurrenceTimes[dayKey]); // Pentru weekly, doar dacă are oră setată

      if (shouldGenerateEvent) {
        // Folosește ora setată sau ora default (12:00)
        const timeStr = recurrenceTimes[dayKey] || '12:00';
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        const eventStart = new Date(currentDate);
        eventStart.setHours(hours, minutes, 0, 0);
        
        const eventEnd = new Date(eventStart);
        eventEnd.setMinutes(eventEnd.getMinutes() + baseEvent.duration);

        const generatedEvent = {
          ...baseEvent,
          id: -Math.abs(baseEvent.id * 1000 + eventStart.getTime()),
          start_datetime: eventStart,
          end_datetime: eventEnd,
          title: `${baseEvent.title} (recurent)`,
          isRecurring: true
        } as CalendarEvent;

        events.push(generatedEvent);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return events;
  }

  // Generare evenimente lunare
  private generateMonthlyEvents(
    baseEvent: CalendarEvent,
    rule: RecurrenceRule,
    recurrenceTimes: { [key: string]: string },
    startDate: Date,
    endDate: Date,
    originalDateStr: string
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const originalDate = new Date(baseEvent.start_datetime);
    const dayOfMonth = originalDate.getDate();
    
    // Ora pentru evenimente lunare
    const monthlyTime = recurrenceTimes['monthly-time'] || '09:00';
    const [hours, minutes] = monthlyTime.split(':').map(Number);

    let currentDate = new Date(rule.start_datetime);
    currentDate.setDate(dayOfMonth);
    currentDate.setHours(hours, minutes, 0, 0);

    // Asigură-te că începem din perioada cerută
    while (currentDate < startDate) {
      currentDate.setMonth(currentDate.getMonth() + rule.interval);
    }

    const ruleEndDate = rule.end_datetime || endDate;

    while (currentDate <= ruleEndDate && currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      if (currentDateStr !== originalDateStr) {
        const eventEnd = new Date(currentDate);
        eventEnd.setMinutes(eventEnd.getMinutes() + baseEvent.duration);

        const generatedEvent = {
          ...baseEvent,
          id: -Math.abs(baseEvent.id * 1000 + currentDate.getTime()),
          start_datetime: new Date(currentDate),
          end_datetime: eventEnd,
          title: `${baseEvent.title} (recurent)`,
          isRecurring: true
        } as CalendarEvent;

        events.push(generatedEvent);
      }

      currentDate.setMonth(currentDate.getMonth() + rule.interval);
    }

    return events;
  }

  // Generare evenimente anuale
  private generateYearlyEvents(
    baseEvent: CalendarEvent,
    rule: RecurrenceRule,
    recurrenceTimes: { [key: string]: string },
    startDate: Date,
    endDate: Date,
    originalDateStr: string
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const originalDate = new Date(baseEvent.start_datetime);
    
    // Ora pentru evenimente anuale
    const yearlyTime = recurrenceTimes['yearly-time'] || '09:00';
    const [hours, minutes] = yearlyTime.split(':').map(Number);

    let currentDate = new Date(rule.start_datetime);
    currentDate.setMonth(originalDate.getMonth());
    currentDate.setDate(originalDate.getDate());
    currentDate.setHours(hours, minutes, 0, 0);

    // Asigură-te că începem din perioada cerută
    while (currentDate < startDate) {
      currentDate.setFullYear(currentDate.getFullYear() + rule.interval);
    }

    const ruleEndDate = rule.end_datetime || endDate;

    while (currentDate <= ruleEndDate && currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      if (currentDateStr !== originalDateStr) {
        const eventEnd = new Date(currentDate);
        eventEnd.setMinutes(eventEnd.getMinutes() + baseEvent.duration);

        const generatedEvent = {
          ...baseEvent,
          id: -Math.abs(baseEvent.id * 1000 + currentDate.getTime()),
          start_datetime: new Date(currentDate),
          end_datetime: eventEnd,
          title: `${baseEvent.title} (recurent)`,
          isRecurring: true
        } as CalendarEvent;

        events.push(generatedEvent);
      }

      currentDate.setFullYear(currentDate.getFullYear() + rule.interval);
    }

    return events;
  }

  // Generare evenimente recurente pentru endpoint specific (actualizat pentru noua logică)
  async generateRecurringEvents(
    recurrenceRuleId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Partial<CalendarEvent>[]> {
    const rule = await this.findRecurrenceRule(recurrenceRuleId);
    
    // Găsește evenimentul template asociat cu această regulă
    const templateEvent = await this.eventRepo.findOne({
      where: { recurrence_id: recurrenceRuleId },
      relations: ['creator']
    });

    if (!templateEvent) {
      throw new NotFoundException('Nu există eveniment template pentru această regulă de recurență');
    }

    const recurrenceTimes = this.parseRecurrenceDays(rule.recurrence_days);
    const events = this.generateEventsFromRule(templateEvent, rule, recurrenceTimes, startDate, endDate);

    // Convertește la Partial<CalendarEvent> pentru compatibilitate cu endpoint-ul
    return events.map(event => ({
      title: event.title,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      category: event.category,
      description: event.description,
      duration: event.duration
    }));
  }
}

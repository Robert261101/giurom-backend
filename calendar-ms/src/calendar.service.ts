import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarEventParticipant } from './entities/calendar-event-participant.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { FilterCalendarEventsDto } from './dto/filter-calendar-events.dto';
import { RespondCalendarEventDto } from './dto/respond-calendar-event.dto';
import { EventCategoryService } from './event-category.service';
import {
  assertJwtEmployeeIdConsistency,
  assertNoArbitraryCompanyFilter,
  assertOperationalLocationFilter,
  CalendarJwtUser,
  getCanonicalEmployeeId,
  getJwtCompanyId,
  getJwtWorkLocationId,
  isCalendarAdminUser,
  isFurnizorSupplierAdmin,
  isOperationalStaffUser,
} from './calendar-access';
import { resolveSupplierCalendarScope } from './calendar-supplier-scope';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(CalendarEventParticipant)
    private readonly participantRepo: Repository<CalendarEventParticipant>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
    private readonly eventCategoryService: EventCategoryService,
  ) {}

  private normalizeUser(user?: CalendarJwtUser | number): CalendarJwtUser | undefined {
    if (user == null) return undefined;
    if (typeof user === 'number') {
      return { sub: user, userId: user, permissions: [] };
    }
    return user;
  }

  private requireUser(user?: CalendarJwtUser | number): CalendarJwtUser {
    const resolved = this.normalizeUser(user);
    if (!resolved) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    assertJwtEmployeeIdConsistency(resolved);
    return resolved;
  }

  private resolveCompanyIdForWrite(user: CalendarJwtUser): number {
    const companyId = getJwtCompanyId(user);
    if (companyId == null) {
      throw new ForbiddenException(
        'Compania nu este configurată în tokenul de autentificare',
      );
    }
    return companyId;
  }

  private validateLocationScope(
    isCompanyWide: boolean,
    locationId?: number | null,
  ): { is_company_wide: boolean; location_id: number | null } {
    if (isCompanyWide) {
      if (locationId != null) {
        throw new BadRequestException(
          'is_company_wide=true implică location_id NULL',
        );
      }
      return { is_company_wide: true, location_id: null };
    }
    if (locationId == null || !Number.isFinite(Number(locationId)) || Number(locationId) <= 0) {
      throw new BadRequestException(
        'location_id este obligatoriu pentru evenimentele care nu sunt company-wide',
      );
    }
    return { is_company_wide: false, location_id: Number(locationId) };
  }

  private async applyReadScopeToQuery(
    qb: SelectQueryBuilder<CalendarEvent>,
    user: CalendarJwtUser,
    authorization?: string,
  ): Promise<void> {
    if (isCalendarAdminUser(user) && !isOperationalStaffUser(user)) {
      const companyId = getJwtCompanyId(user);
      if (companyId != null) {
        qb.andWhere('event.company_id = :scopeCompanyId', {
          scopeCompanyId: companyId,
        });
      }
      return;
    }

    if (isFurnizorSupplierAdmin(user)) {
      const supplierScope = await resolveSupplierCalendarScope(user, authorization);
      qb.andWhere('event.company_id = :scopeCompanyId', {
        scopeCompanyId: supplierScope.companyId,
      });
      const locIds = supplierScope.permittedLocationIds;
      qb.andWhere(
        new Brackets((sub) => {
          sub.where(
            "(event.event_type = 'general' AND (event.is_company_wide = 1 OR event.location_id IN (:...supplierLocIds)))",
            { supplierLocIds: locIds.length > 0 ? locIds : [-1] },
          );
          sub.orWhere("event.event_type = 'meeting'");
        }),
      );
      return;
    }

    if (isOperationalStaffUser(user)) {
      const companyId = getJwtCompanyId(user);
      const locationId = getJwtWorkLocationId(user);
      const employeeId = getCanonicalEmployeeId(user);
      if (companyId == null || locationId == null || employeeId == null) {
        throw new ForbiddenException(
          'Datele de autentificare operaționale sunt incomplete',
        );
      }
      qb.andWhere('event.company_id = :scopeCompanyId', {
        scopeCompanyId: companyId,
      });
      qb.andWhere(
        new Brackets((sub) => {
          sub.where(
            "(event.event_type = 'general' AND (event.is_company_wide = 1 OR event.location_id = :scopeLocationId))",
            { scopeLocationId: locationId },
          );
          sub.orWhere(
            "(event.event_type = 'meeting' AND EXISTS (SELECT 1 FROM calendar_event_participant cep WHERE cep.event_id = event.id AND cep.employee_id = :scopeEmployeeId))",
            { scopeEmployeeId: employeeId },
          );
        }),
      );
      return;
    }

    const employeeId = getCanonicalEmployeeId(user);
    if (employeeId == null) {
      throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
    }
    qb.andWhere('event.created_by_employee_id = :scopeEmployeeId', {
      scopeEmployeeId: employeeId,
    });
  }

  private async assertCanReadEvent(
    event: CalendarEvent,
    user: CalendarJwtUser,
    authorization?: string,
  ): Promise<void> {
    if (event.status === 'cancelled' && isOperationalStaffUser(user)) {
      const employeeId = getCanonicalEmployeeId(user);
      if (event.event_type === 'meeting' && employeeId != null) {
        const participant = await this.participantRepo.findOne({
          where: { event_id: event.id, employee_id: employeeId },
        });
        if (!participant) {
          throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
        }
      } else {
        throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
      }
    }

    if (isCalendarAdminUser(user) && !isOperationalStaffUser(user)) {
      const companyId = getJwtCompanyId(user);
      if (companyId != null && Number(event.company_id) !== companyId) {
        throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
      }
      return;
    }

    if (isFurnizorSupplierAdmin(user)) {
      const supplierScope = await resolveSupplierCalendarScope(user, authorization);
      if (Number(event.company_id) !== supplierScope.companyId) {
        throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
      }
      if (event.event_type === 'general' && !event.is_company_wide) {
        if (
          event.location_id != null &&
          !supplierScope.permittedLocationIds.includes(Number(event.location_id))
        ) {
          throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
        }
      }
      return;
    }

    if (isOperationalStaffUser(user)) {
      const companyId = getJwtCompanyId(user);
      const locationId = getJwtWorkLocationId(user);
      const employeeId = getCanonicalEmployeeId(user);
      if (companyId == null || locationId == null || employeeId == null) {
        throw new ForbiddenException(
          'Datele de autentificare operaționale sunt incomplete',
        );
      }
      if (Number(event.company_id) !== companyId) {
        throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
      }
      if (event.event_type === 'meeting') {
        const participant = await this.participantRepo.findOne({
          where: { event_id: event.id, employee_id: employeeId },
        });
        if (!participant) {
          throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
        }
        return;
      }
      if (event.is_company_wide) {
        return;
      }
      if (event.location_id == null || Number(event.location_id) !== locationId) {
        throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
      }
      return;
    }

    const employeeId = getCanonicalEmployeeId(user);
    if (employeeId == null || event.created_by_employee_id !== employeeId) {
      throw new ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
    }
  }

  private async assertCanManageEvent(
    event: CalendarEvent,
    user?: CalendarJwtUser | number,
    authorization?: string,
  ): Promise<void> {
    const resolvedUser = this.requireUser(user);
    await this.assertCanReadEvent(event, resolvedUser, authorization);

    if (isOperationalStaffUser(resolvedUser)) {
      throw new ForbiddenException('Nu ai permisiunea să gestionezi acest eveniment');
    }
  }

  private async sendCalendarNotification(
    type: string,
    title: string,
    description: string,
    entity_id?: number,
    metadata?: Record<string, unknown>,
    target_url?: string,
    work_location_id?: number,
  ): Promise<void> {
    try {
      const payload = {
        type,
        title,
        description,
        entity_id,
        entity_type: 'calendar_event',
        metadata: { ...metadata, ...(work_location_id != null ? { work_location_id } : {}) },
        priority: 'medium',
        target_url,
      };
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'calendar.notification' }, payload),
      );
    } catch (error) {
      console.error('Failed to send calendar notification:', error);
    }
  }

  async createEvent(
    dto: CreateCalendarEventDto,
    user?: CalendarJwtUser | number,
  ): Promise<CalendarEvent> {
    const resolvedUser = this.requireUser(user);
    if (isOperationalStaffUser(resolvedUser)) {
      throw new ForbiddenException('Nu ai permisiunea să creezi evenimente');
    }

    await this.eventCategoryService.findOne(dto.category_id);

    const startDate = new Date(dto.start_datetime);
    const endDate = new Date(dto.end_datetime);
    if (endDate <= startDate) {
      throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
    }

    const eventType = dto.event_type ?? 'general';
    if (eventType === 'general' && dto.participant_employee_ids?.length) {
      throw new BadRequestException(
        'Evenimentele general nu acceptă participanți / RSVP',
      );
    }
    if (eventType === 'meeting' && !dto.participant_employee_ids?.length) {
      throw new BadRequestException(
        'Ședințele necesită cel puțin un participant',
      );
    }

    const locationScope = this.validateLocationScope(
      dto.is_company_wide === true,
      dto.location_id,
    );

    const employeeId = getCanonicalEmployeeId(resolvedUser);
    if (employeeId == null) {
      throw new ForbiddenException('Angajatul creator nu a fost identificat în JWT');
    }

    const event = this.eventRepo.create({
      title: dto.title,
      category_id: dto.category_id,
      start_datetime: startDate,
      end_datetime: endDate,
      description: dto.description ?? null,
      all_day: dto.all_day ?? false,
      company_id: this.resolveCompanyIdForWrite(resolvedUser),
      created_by_employee_id: employeeId,
      event_type: eventType,
      status: 'active',
      ...locationScope,
    });

    const savedEvent = await this.eventRepo.save(event);

    if (eventType === 'meeting' && dto.participant_employee_ids?.length) {
      const rows = dto.participant_employee_ids.map((id) =>
        this.participantRepo.create({
          event_id: savedEvent.id,
          employee_id: id,
          response_status: 'pending',
          responded_at: null,
        }),
      );
      await this.participantRepo.save(rows);
    }

    await this.sendCalendarNotification(
      'calendar_event_created',
      'Eveniment nou creat',
      `A fost creat un nou eveniment în calendar: ${savedEvent.title}`,
      savedEvent.id,
      {
        eventId: savedEvent.id,
        title: savedEvent.title,
        startDatetime: savedEvent.start_datetime,
        createdBy: savedEvent.created_by_employee_id,
      },
      '/evenimente',
      savedEvent.location_id ?? undefined,
    );

    return savedEvent;
  }

  async findEvents(
    filters: FilterCalendarEventsDto,
    user?: CalendarJwtUser | number,
    authorization?: string,
  ): Promise<CalendarEvent[]> {
    const resolvedUser = this.requireUser(user);
    assertNoArbitraryCompanyFilter(filters as Record<string, unknown>);

    if (isOperationalStaffUser(resolvedUser)) {
      assertOperationalLocationFilter(resolvedUser, filters.location_id);
    }

    const qb = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoryEntity', 'categoryEntity');

    const statusFilter = filters.status ?? 'active';
    if (statusFilter !== 'all') {
      qb.andWhere('event.status = :eventStatus', { eventStatus: statusFilter });
    }

    if (filters.start_date && filters.end_date) {
      qb.andWhere('event.start_datetime BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.start_date),
        endDate: new Date(filters.end_date),
      });
    } else if (filters.start_date) {
      qb.andWhere('event.start_datetime >= :startDate', {
        startDate: new Date(filters.start_date),
      });
    } else if (filters.end_date) {
      qb.andWhere('event.start_datetime <= :endDate', {
        endDate: new Date(filters.end_date),
      });
    }

    if (filters.category_id != null) {
      qb.andWhere('event.category_id = :categoryId', {
        categoryId: filters.category_id,
      });
    }

    if (filters.category_code) {
      qb.andWhere('categoryEntity.code = :categoryCode', {
        categoryCode: filters.category_code,
      });
    }

    if (filters.created_by_employee_id != null) {
      qb.andWhere('event.created_by_employee_id = :createdByEmployeeId', {
        createdByEmployeeId: filters.created_by_employee_id,
      });
    }

    if (filters.search) {
      qb.andWhere(
        '(event.title LIKE :search OR event.description LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.location_id != null) {
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('event.location_id = :locationId', {
            locationId: filters.location_id,
          });
          sub.orWhere('event.is_company_wide = 1');
        }),
      );
    }

    await this.applyReadScopeToQuery(qb, resolvedUser, authorization);
    qb.orderBy('event.start_datetime', 'ASC');

    return qb.getMany();
  }

  async findOne(
    id: number,
    user?: CalendarJwtUser | number,
    authorization?: string,
  ): Promise<CalendarEvent> {
    const resolvedUser = this.requireUser(user);
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['categoryEntity', 'participants'],
    });

    if (!event) {
      throw new NotFoundException('Evenimentul nu a fost găsit');
    }

    await this.assertCanReadEvent(event, resolvedUser, authorization);
    return event;
  }

  async updateEvent(
    id: number,
    dto: UpdateCalendarEventDto,
    user?: CalendarJwtUser | number,
    authorization?: string,
  ): Promise<CalendarEvent> {
    const event = await this.findOne(id, user, authorization);
    await this.assertCanManageEvent(event, user, authorization);

    if (dto.category_id != null) {
      await this.eventCategoryService.findOne(dto.category_id);
    }

    const nextIsCompanyWide = dto.is_company_wide ?? event.is_company_wide;
    const nextLocationId =
      dto.location_id !== undefined ? dto.location_id : event.location_id;
    const locationScope = this.validateLocationScope(nextIsCompanyWide, nextLocationId);

    if (dto.start_datetime || dto.end_datetime) {
      const startDate = dto.start_datetime
        ? new Date(dto.start_datetime)
        : event.start_datetime;
      const endDate = dto.end_datetime
        ? new Date(dto.end_datetime)
        : event.end_datetime;
      if (endDate <= startDate) {
        throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
      }
    }

    if (dto.event_type === 'general' && event.event_type === 'meeting') {
      throw new BadRequestException(
        'Nu se poate converti o ședință în eveniment general fără migrare dedicată',
      );
    }

    Object.assign(event, {
      title: dto.title ?? event.title,
      category_id: dto.category_id ?? event.category_id,
      description: dto.description !== undefined ? dto.description : event.description,
      all_day: dto.all_day ?? event.all_day,
      event_type: dto.event_type ?? event.event_type,
      status: dto.status ?? event.status,
      start_datetime: dto.start_datetime ? new Date(dto.start_datetime) : event.start_datetime,
      end_datetime: dto.end_datetime ? new Date(dto.end_datetime) : event.end_datetime,
      ...locationScope,
    });

    return this.eventRepo.save(event);
  }

  async removeEvent(
    id: number,
    user?: CalendarJwtUser | number,
    authorization?: string,
  ): Promise<void> {
    const event = await this.findOne(id, user, authorization);
    await this.assertCanManageEvent(event, user, authorization);
    await this.eventRepo.remove(event);
  }

  async respondToInvitation(
    id: number,
    dto: RespondCalendarEventDto,
    user?: CalendarJwtUser | number,
  ): Promise<CalendarEventParticipant> {
    const resolvedUser = this.requireUser(user);
    const employeeId = getCanonicalEmployeeId(resolvedUser);
    if (employeeId == null) {
      throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
    }

    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Evenimentul nu a fost găsit');
    }
    if (event.event_type !== 'meeting') {
      throw new BadRequestException('Doar ședințele acceptă răspuns la invitație');
    }
    if (event.status === 'cancelled') {
      throw new BadRequestException('Evenimentul este anulat');
    }

    await this.assertCanReadEvent(event, resolvedUser);

    const participant = await this.participantRepo.findOne({
      where: { event_id: id, employee_id: employeeId },
    });
    if (!participant) {
      throw new ForbiddenException('Nu ești participant la această ședință');
    }

    participant.response_status = dto.response_status;
    participant.responded_at = new Date();
    return this.participantRepo.save(participant);
  }

  async getEventCategories() {
    return this.eventCategoryService.findAllActive();
  }
}

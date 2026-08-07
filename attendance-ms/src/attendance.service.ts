import {
  buildAttendanceUserContext,
  hasAttendanceManagePermission,
  isAdminOrSuperAdmin,
  isFurnizorTenant,
  isOperationalEmployee,
  assertEmployeeSelfOrManager,
  assertOperationalSelfService,
  canCorrectAttendance,
  isOperationalStaffUser,
  type AttendanceUserContext,
} from './attendance-access';
import {
  appendCorrectionAudit,
  extractCorrectionReasons,
} from './attendance-notes.util';
import {
  buildClosedIntervalMinutes,
  findOpenEntryInflexion,
  sortInflexions,
  validateInflexionTimeline,
} from './attendance-interval.util';
import { CorrectPresenceDto, PresenceCorrectionAction } from './dto/correct-presence.dto';
import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit, Inject, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, Not, QueryFailedError } from 'typeorm';
import { format } from 'date-fns';
import { Shift } from './entities/shift.entity';
import { Presence, PresenceStatus } from './entities/presence.entity';
import { PresenceInflexion, InflexionType } from './entities/presence-inflexion.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreatePresenceDto } from './dto/create-presence.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { CreatePresenceInflexionDto } from './dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from './dto/update-presence-inflexion.dto';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const ROMANIA_TZ = 'Europe/Bucharest';

@Injectable()
export class AttendanceService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceService.name);

  private readonly punchGateByEmployee = new Map<number, Promise<unknown>>();

  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Presence)
    private readonly presenceRepository: Repository<Presence>,
    @InjectRepository(PresenceInflexion)
    private readonly presenceInflexionRepository: Repository<PresenceInflexion>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    // Ensure position_id is optional at DB level (nullable)
    try {
      await this.shiftRepository.query("ALTER TABLE `shifts` MODIFY `position_id` INT NULL DEFAULT NULL");
    } catch (_e) {
      // ignore if already applied or lacks permission
    }
  }

  private async sendAttendanceNotification(
    type: string,
    title: string,
    description: string,
    userId: number,
    metadata?: any,
    work_location_id?: number,
  ): Promise<void> {
    try {
      const payload: any = {
        type,
        title,
        description,
        user_id: userId,
        entity_type: 'attendance',
        metadata: { ...metadata, ...(work_location_id != null ? { work_location_id } : {}) },
        priority: 'medium',
      };
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'attendance.notification' }, payload)
      );
    } catch (error) {
      console.error('Failed to send attendance notification:', error);
    }
  }

  private async addEmployeePoints(
    employeeId: number,
    points: number,
    reason: string,
    workDateRoz?: string,
    locationId?: number,
  ): Promise<void> {
    try {
      const workDate =
        workDateRoz ??
        formatInTimeZone(new Date(), ROMANIA_TZ, 'yyyy-MM-dd');
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:3002/tasks/executions/daily-points', {
          employee_id: employeeId,
          total_points: points,
          work_date: workDate,
          location_id: locationId,
        })
      );
      this.logger.log(`✅ Added ${points} points to employee ${employeeId}: ${reason}`);
    } catch (error) {
      console.error(`❌ Failed to add points to employee ${employeeId}:`, error.response?.data || error.message);
    }
  }

  private async sendShiftNotification(
    type: string,
    title: string,
    description: string,
    userId: number,
    shiftId: number,
    metadata?: any,
    target_url?: string,
    work_location_id?: number,
  ): Promise<void> {
    try {
      const payload: any = {
        type,
        title,
        description,
        user_id: userId,
        entity_id: shiftId,
        entity_type: 'shift',
        metadata: { ...metadata, ...(work_location_id != null ? { work_location_id } : {}) },
        priority: 'medium',
        target_url,
      };
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'shift.notification' }, payload)
      );
    } catch (error) {
      console.error('Failed to send shift notification:', error);
    }
  }

  // SHIFT METHODS
  async createShift(createShiftDto: CreateShiftDto): Promise<Shift> {
    const { start_datetime, end_datetime, employee_id, ...rest } = createShiftDto;

    // Validare date
    const startDate = toZonedTime(new Date(start_datetime), 'Europe/Bucharest');
    const endDate = toZonedTime(new Date(end_datetime), 'Europe/Bucharest');

    if (startDate >= endDate) {
      throw new BadRequestException('Data de început trebuie să fie înainte de data de sfârșit');
    }

    // Verifică overlap cu alte schimburi pentru același angajat
    const overlappingShift = await this.shiftRepository.findOne({
      where: [
        {
          employee_id,
          start_datetime: LessThanOrEqual(endDate),
          end_datetime: MoreThanOrEqual(startDate),
        },
      ],
    });

    if (overlappingShift) {
      throw new ConflictException('Există deja un schimb programat pentru acest angajat în intervalul specificat');
    }

    const shift = this.shiftRepository.create({
      ...rest,
      position_id: (rest as any).position_id ?? null,
      employee_id,
      start_datetime: startDate,
      end_datetime: endDate,
    });

    const savedShift = await this.shiftRepository.save(shift);
    
    const timeOpt = { hour: '2-digit' as const, minute: '2-digit' as const };
    const locId = (savedShift as any).work_location_id ?? (createShiftDto as any).work_location_id;
    await this.sendShiftNotification(
      'shift_created',
      'Pontaj creat',
      `S-a creat pontaj pentru data de ${startDate.toLocaleDateString('ro-RO')}, început ${startDate.toLocaleTimeString('ro-RO', timeOpt)} și sfârșit ${endDate.toLocaleTimeString('ro-RO', timeOpt)}`,
      employee_id,
      savedShift.id,
      {
        shiftId: savedShift.id,
        employeeId: employee_id,
        startDate: startDate,
        endDate: endDate,
      },
      '/pontaj',
      locId,
    );

    return savedShift;
  }

  async findAllShifts(
    page: number = 1,
    limit: number = 10,
    employee_id?: number,
    work_location_id?: number,
    department_id?: number,
    allowedEmployeeIds?: number[],
  ): Promise<{ data: Shift[]; total: number; page: number; limit: number }> {
    const qb = this.shiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.presences', 'presences')
      .leftJoinAndSelect('presences.inflexions', 'inflexions')
      .orderBy('shift.start_datetime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (allowedEmployeeIds && allowedEmployeeIds.length > 0) {
      // Operațional: restricție la lista de colegi din aceeași locație
      if (employee_id != null) {
        if (!allowedEmployeeIds.includes(employee_id)) {
          return { data: [], total: 0, page, limit };
        }
        qb.andWhere('shift.employee_id = :employee_id', { employee_id });
      } else {
        qb.andWhere('shift.employee_id IN (:...allowedEmployeeIds)', { allowedEmployeeIds });
      }
    } else {
      if (employee_id) qb.andWhere('shift.employee_id = :employee_id', { employee_id });
    }

    if (work_location_id) qb.andWhere('shift.work_location_id = :work_location_id', { work_location_id });
    if (department_id) qb.andWhere('shift.department_id = :department_id', { department_id });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  private async assertEmployeeInCompany(
    employeeId: number,
    companyId: number,
  ): Promise<void> {
    const base =
      process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3011';
    try {
      const resp = await firstValueFrom(
        this.httpService.get(`${base}/employees/company/${companyId}`, {
          headers: {
            'x-internal-service': 'attendance',
            'x-service-secret': process.env.SERVICE_SECRET || '',
          },
          timeout: 8000,
        }),
      );
      const list = Array.isArray(resp.data?.data)
        ? resp.data.data
        : Array.isArray(resp.data)
          ? resp.data
          : [];
      const ids = list
        .map((e: { id?: number }) => Number(e?.id))
        .filter((id: number) => Number.isFinite(id) && id > 0);
      if (!ids.includes(employeeId)) {
        throw new ForbiddenException(
          'Angajatul nu aparține companiei dumneavoastră',
        );
      }
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(
        'Nu s-a putut verifica apartenența angajatului la companie',
      );
    }
  }

  private async assertEmployeeAttendanceAccess(
    targetEmployeeId: number,
    user?: any,
    authorization?: string,
    opts?: { allowedEmployeeIds?: number[]; requireManage?: boolean },
  ): Promise<void> {
    if (!user) {
      return;
    }

    const ctx = buildAttendanceUserContext(user);
    const requireManage = opts?.requireManage === true;

    if (ctx.employeeId != null && ctx.employeeId === targetEmployeeId) {
      return;
    }
    if (opts?.allowedEmployeeIds?.includes(targetEmployeeId)) {
      return;
    }

    if (ctx.permissions.includes('assignment.read_all')) {
      if (!requireManage || hasAttendanceManagePermission(ctx.permissions)) {
        return;
      }
    }

    if (
      ctx.permissions.includes('assignment.read_company') &&
      !ctx.permissions.includes('assignment.read_all')
    ) {
      if (
        (!requireManage ||
          hasAttendanceManagePermission(ctx.permissions)) &&
        ctx.companyId != null
      ) {
        await this.assertEmployeeInCompany(targetEmployeeId, ctx.companyId);
        return;
      }
    }

    if (isFurnizorTenant(ctx)) {
      await this.assertFurnizorStaffMember(
        targetEmployeeId,
        ctx,
        authorization,
      );
      return;
    }

    if (isOperationalStaffUser(user) && !requireManage) {
      const colleagueIds = await this.fetchOperationalColleagueIds(user);
      if (colleagueIds.includes(targetEmployeeId)) {
        return;
      }
    }

    throw new ForbiddenException('Nu aveți acces la pontajul acestui angajat');
  }

  async findShiftById(
    id: number,
    user?: any,
    authorization?: string,
  ): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['presences'],
    });

    if (!shift) {
      throw new NotFoundException(`Schimbul cu ID-ul ${id} nu a fost găsit`);
    }

    if (user) {
      await this.assertEmployeeAttendanceAccess(
        shift.employee_id,
        user,
        authorization,
      );
    }

    return shift;
  }

  async updateShift(
    id: number,
    updateShiftDto: UpdateShiftDto,
    user?: any,
    authorization?: string,
  ): Promise<Shift> {
    const shift = await this.findShiftById(id, user, authorization);

    if (updateShiftDto.start_datetime || updateShiftDto.end_datetime) {
        const startDate = updateShiftDto.start_datetime
          ? toZonedTime(new Date(updateShiftDto.start_datetime), 'Europe/Bucharest')
          : shift.start_datetime;
        const endDate = updateShiftDto.end_datetime
          ? toZonedTime(new Date(updateShiftDto.end_datetime), 'Europe/Bucharest')
          : shift.end_datetime;

      if (startDate >= endDate) {
        throw new BadRequestException('Data de început trebuie să fie înainte de data de sfârșit');
      }

      // Verifică overlap cu alte schimburi
      const overlappingShift = await this.shiftRepository.findOne({
        where: [
          {
            id: Not(id),
            employee_id: shift.employee_id,
            start_datetime: LessThanOrEqual(endDate),
            end_datetime: MoreThanOrEqual(startDate),
          },
        ],
      });

      if (overlappingShift) {
        throw new ConflictException('Există deja un schimb programat pentru acest angajat în intervalul specificat');
      }

    }

    Object.assign(shift, updateShiftDto);
    const savedShift = await this.shiftRepository.save(shift);

    const startDt = savedShift.start_datetime instanceof Date ? savedShift.start_datetime : new Date(savedShift.start_datetime);
    const endDt = savedShift.end_datetime instanceof Date ? savedShift.end_datetime : new Date(savedShift.end_datetime);
    const timeOpt = { hour: '2-digit' as const, minute: '2-digit' as const };
    const locId = (savedShift as any).work_location_id;
    await this.sendShiftNotification(
      'shift_updated',
      'Pontaj modificat',
      `Pentru data de ${startDt.toLocaleDateString('ro-RO')} s-a modificat pontajul în început ${startDt.toLocaleTimeString('ro-RO', timeOpt)} și sfârșit ${endDt.toLocaleTimeString('ro-RO', timeOpt)}`,
      savedShift.employee_id,
      savedShift.id,
      {
        shiftId: savedShift.id,
        employeeId: savedShift.employee_id,
        startDate: savedShift.start_datetime,
        endDate: savedShift.end_datetime,
      },
      '/pontaj',
      locId,
    );

    return savedShift;
  }

  async deleteShift(
    id: number,
    user?: any,
    authorization?: string,
  ): Promise<void> {
    const shift = await this.findShiftById(id, user, authorization);

    const startDtDel = shift.start_datetime instanceof Date ? shift.start_datetime : new Date(shift.start_datetime);
    const locId = (shift as any).work_location_id;
    await this.sendShiftNotification(
      'shift_deleted',
      'Pontaj șters',
      `Ți s-a șters pontajul din data de ${startDtDel.toLocaleDateString('ro-RO')}`,
      shift.employee_id,
      shift.id,
      {
        shiftId: shift.id,
        employeeId: shift.employee_id,
        startDate: shift.start_datetime,
        endDate: shift.end_datetime,
      },
      '/pontaj',
      locId,
    );

    // Delete all associated presences and their inflexions
    for (const presence of shift.presences) {
      await this.presenceInflexionRepository.delete({ presence_id: presence.id } as any);
      await this.presenceRepository.remove(presence);
    }

    await this.shiftRepository.remove(shift);
  }

  // PRESENCE METHODS
  /**
   * Normalizează o dată la începutul zilei (fără oră) pentru comparație consistentă shift_id + date.
   */
  private normalizeDateOnly(date: string | Date): Date {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Puncte + notificare după pontaj: rulează în fundal ca răspunsul POST /presences să nu aștepte HTTP către tasks / RMQ.
   */
  private async runCreatePresenceSideEffectsAfterSave(params: {
    check_in: string | undefined;
    shift: Shift;
    shift_id: number;
    date: string;
    savedPresenceId: number;
  }): Promise<void> {
    const { check_in, shift, shift_id, date, savedPresenceId } = params;
    const locId = (shift as any).work_location_id;

    if (check_in) {
      const checkInInstantMs = new Date(check_in).getTime();
      const ymdRo = formatInTimeZone(new Date(check_in), ROMANIA_TZ, 'yyyy-MM-dd');
      // Folosim start-ul real al turei din DB (unic instant), nu „ziua check-in-ului + ora din shift”:
      // altfel turele nocturne / trecerea peste miezul nopții puteau calcula o oră de start greșită
      // și un singur angajat (alt format de date sau tură atipică) putea fi evaluat incorect.
      const shiftStartMs = new Date(shift.start_datetime as unknown as string).getTime();
      const minimumLeadTimeMs = 60 * 60 * 1000;
      const earlyLeadMs = shiftStartMs - checkInInstantMs;

      this.logger.log(`🕐 [Punctualitate] check_in=${new Date(checkInInstantMs).toISOString()} zi_RO=${ymdRo} shift_start=${new Date(shiftStartMs).toISOString()}`,);
      this.logger.log(`🕐 [Punctualitate] lead până la start (ms)=${earlyLeadMs}, prag: ${minimumLeadTimeMs}`,);

      if (Number.isNaN(shiftStartMs)) {
        console.warn(
          `⚠️ [Punctualitate] start_datetime invalid pentru shift ${shift.id} – puncte oprite`,
        );
      } else if (earlyLeadMs >= minimumLeadTimeMs) {
        await this.addEmployeePoints(
          shift.employee_id,
          5,
          `Punctualitate - început program cu cel puțin o oră înainte (${formatInTimeZone(new Date(check_in), ROMANIA_TZ, 'HH:mm')})`,
          ymdRo,
          Number((shift as any).work_location_id),
        );
      } else {
        this.logger.log(`⏰ Check-in pentru angajat ${shift.employee_id} nu respectă pragul de 1 oră înainte de start-ul turei – nu se acordă puncte`,);
      }
    }

    await this.sendAttendanceNotification(
      'attendance_created',
      'Pontaj creat',
      `A fost creat un nou pontaj pentru data de ${new Date(date).toLocaleDateString('ro-RO')}`,
      shift.employee_id,
      {
        presenceId: savedPresenceId,
        shiftId: shift_id,
        date: date,
        employeeId: shift.employee_id,
      },
      locId,
    );
  }

  async createPresence(createPresenceDto: CreatePresenceDto): Promise<Presence> {
    const { shift_id, date, check_in, check_out, ...rest } = createPresenceDto;

    // Verifică dacă schimbul există
    const shift = await this.shiftRepository.findOne({ where: { id: shift_id } });
    if (!shift) {
      throw new NotFoundException(`Schimbul cu ID-ul ${shift_id} nu a fost găsit`);
    }

    const dateNorm = this.normalizeDateOnly(date);

    // Validare check-in și check-out
    if (check_in && check_out) {
      const checkInDate = new Date(check_in);
      const checkOutDate = new Date(check_out);

      if (checkInDate >= checkOutDate) {
        throw new BadRequestException('Check-in trebuie să fie înainte de check-out');
      }

      // Calculează automat orele lucrate
      if (!rest.total_hours) {
        const diffMs = checkOutDate.getTime() - checkInDate.getTime();
        rest.total_hours = diffMs / (1000 * 60 * 60); // convertire în ore
      }
    }

    // Calculează auto_checkout bazat pe ora de sfârșit a shift-ului + time_for_checkout pentru ziua curentă
    let autoCheckout: Date | null = null;
    if (check_in && shift.end_datetime) {
      const shiftEndTime = new Date(shift.end_datetime);
      const shiftEndHour = shiftEndTime.getHours();
      const shiftEndMinute = shiftEndTime.getMinutes();
      
      // Folosim data din check_in (nu date) pentru a calcula auto_checkout
      // Astfel funcționează corect și când check_in este după miezul nopții
      const checkInDate = new Date(check_in);
      const checkInDay = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
      const todayShiftEnd = new Date(checkInDay);
      todayShiftEnd.setHours(shiftEndHour, shiftEndMinute, 0, 0);
      
      // Adaugă time_for_checkout (în minute) la ora de sfârșit
      const timeForCheckout = shift.time_for_checkout || 0;
      if (timeForCheckout > 0) {
        todayShiftEnd.setMinutes(todayShiftEnd.getMinutes() + timeForCheckout);
      }
      
      autoCheckout = toZonedTime(todayShiftEnd, 'Europe/Bucharest') as any;
      
      this.logger.log(`🕐 Auto-checkout calculat: ${autoCheckout.toISOString()} (din shift.end_datetime: ${shift.end_datetime} + ${timeForCheckout} minute, check_in: ${check_in})`);
    }

    let savedPresence: Presence;
    try {
      savedPresence = await this.presenceRepository.manager.transaction(async (em) => {
        const presenceRepo = em.getRepository(Presence);
        const existingPresence = await presenceRepo.findOne({
          where: { shift_id, date: dateNorm },
          lock: { mode: 'pessimistic_write' },
        });
        if (existingPresence) {
          throw new ConflictException('Există deja o prezență înregistrată pentru această dată și schimb');
        }
        const presence = presenceRepo.create({
          ...rest,
          shift_id,
          date: dateNorm,
          check_in: check_in ? toZonedTime(new Date(check_in), 'Europe/Bucharest') : null,
          check_out: check_out ? toZonedTime(new Date(check_out), 'Europe/Bucharest') : null,
          auto_checkout: autoCheckout,
        });
        return await presenceRepo.save(presence);
      });
    } catch (err: any) {
      if (err instanceof ConflictException) throw err;
      const isDuplicate = err instanceof QueryFailedError && (err as any).driverError?.code === 'ER_DUP_ENTRY';
      if (isDuplicate) {
        throw new ConflictException('Există deja o prezență înregistrată pentru această dată și schimb');
      }
      throw err;
    }

    void this.runCreatePresenceSideEffectsAfterSave({
      check_in,
      shift,
      shift_id,
      date,
      savedPresenceId: savedPresence.id,
    }).catch((err) =>
      console.error('❌ Eroare efecte după create presence (puncte/notificare):', err),
    );

    return savedPresence;
  }

  async findAllPresences(
    page?: string,
    limit?: string,
    shift_id?: string,
    status?: PresenceStatus,
    start_date?: string,
    end_date?: string,
    work_location_id?: string,
  ): Promise<{ data: Presence[]; total: number; page: number; limit: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const shiftIdNum = shift_id ? parseInt(shift_id, 10) : undefined;
    const workLocationIdNum = work_location_id ? parseInt(work_location_id, 10) : undefined;
    
    // Folosim query builder pentru a permite filtrarea după work_location_id prin join
    const queryBuilder = this.presenceRepository
      .createQueryBuilder('presence')
      .leftJoinAndSelect('presence.shift', 'shift')
      .leftJoinAndSelect('presence.inflexions', 'inflexions');
    
    if (shiftIdNum) {
      queryBuilder.andWhere('presence.shift_id = :shiftId', { shiftId: shiftIdNum });
    }
    
    if (workLocationIdNum) {
      queryBuilder.andWhere('shift.work_location_id = :workLocationId', { workLocationId: workLocationIdNum });
    }
    
    if (status) {
      queryBuilder.andWhere('presence.status = :status', { status });
    }

    if (start_date && end_date) {
      if (start_date === end_date) {
        // Când start_date și end_date sunt egale, filtrează doar pentru acea dată
        // Filtrează după presence.date SAU shift.start_datetime (pentru a include prezențe care au shift-uri în acea zi)
        const targetDate = new Date(start_date);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        queryBuilder.andWhere(
          '(presence.date BETWEEN :startOfDay AND :endOfDay OR DATE(shift.start_datetime) = :targetDateStr)',
          { startOfDay, endOfDay, targetDateStr }
        );
      } else {
        // Filtrează după presence.date SAU shift.start_datetime
        const startDateStr = format(new Date(start_date), 'yyyy-MM-dd');
        const endDateStr = format(new Date(end_date), 'yyyy-MM-dd');
        queryBuilder.andWhere(
          '(presence.date BETWEEN :startDate AND :endDate OR DATE(shift.start_datetime) BETWEEN :startDateStr AND :endDateStr)',
          { 
            startDate: new Date(start_date), 
            endDate: new Date(end_date),
            startDateStr,
            endDateStr
          }
        );
      }
    } else if (start_date) {
      const startDateStr = format(new Date(start_date), 'yyyy-MM-dd');
      queryBuilder.andWhere(
        '(presence.date >= :startDate OR DATE(shift.start_datetime) >= :startDateStr)',
        { startDate: new Date(start_date), startDateStr }
      );
    } else if (end_date) {
      const endDateStr = format(new Date(end_date), 'yyyy-MM-dd');
      queryBuilder.andWhere(
        '(presence.date <= :endDate OR DATE(shift.start_datetime) <= :endDateStr)',
        { endDate: new Date(end_date), endDateStr }
      );
    }
    
    queryBuilder
      .orderBy('presence.date', 'DESC')
      .skip((pageNum - 1) * limitNum)
      .take(limitNum);
    
    const [data, total] = await queryBuilder.getManyAndCount();
    
    return { data, total, page: pageNum, limit: limitNum };
  }

  async findPresenceById(
    id: number,
    user?: any,
    authorization?: string,
  ): Promise<Presence> {
    const presence = await this.presenceRepository.findOne({
      where: { id },
      relations: ['shift', 'inflexions'],
    });

    if (!presence) {
      throw new NotFoundException(`Prezența cu ID-ul ${id} nu a fost găsită`);
    }

    if (user && presence.shift?.employee_id != null) {
      await this.assertEmployeeAttendanceAccess(
        presence.shift.employee_id,
        user,
        authorization,
      );
    }

    return presence;
  }

  async updatePresence(
    id: number,
    updatePresenceDto: UpdatePresenceDto,
    user?: any,
    authorization?: string,
  ): Promise<Presence> {
    const presence = await this.findPresenceById(id, user, authorization);

    this.logger.log('[AttendanceService] updatePresence called:', {
      presenceId: id,
      presenceShiftId: presence?.shift_id,
      presenceCheckOut: presence?.check_out,
      updateData: updatePresenceDto,
      user: user ? { userId: user.userId, permissions: user.permissions } : null
    });

    // Verifică dacă utilizatorul are permisiunea attendance.update
    const hasUpdatePermission = user?.permissions?.includes('attendance.update') || false;

    if (hasUpdatePermission && presence.shift?.employee_id != null) {
      await this.assertEmployeeAttendanceAccess(
        presence.shift.employee_id,
        user,
        authorization,
        { requireManage: true },
      );
    }
    
    // Dacă utilizatorul nu are permisiunea, verifică dacă prezența aparține angajatului
    if (!hasUpdatePermission) {
      // Verifică dacă prezența aparține angajatului prin shift
      const userEmployeeId = user?.userId || user?.id || user?.employee_id || user?.id_employee || user?.sub;
      
      this.logger.log('[AttendanceService] No update permission, checking ownership:', {
        userEmployeeId,
        presenceShiftId: presence?.shift_id
      });
      
      if (!presence?.shift_id || !userEmployeeId) {
        this.logger.log('[AttendanceService] Missing shift_id or userEmployeeId');
        throw new BadRequestException('Nu aveți permisiunea de a modifica această prezență');
      }
      
      const shift = await this.shiftRepository.findOne({
        where: { id: presence.shift_id },
      });
      const shiftEmployeeId = Number(shift?.employee_id);
      const userEmployeeIdNum = Number(userEmployeeId);
      
      this.logger.log('[AttendanceService] Comparing employee IDs:', {
        shiftEmployeeId,
        userEmployeeIdNum,
        match: shiftEmployeeId === userEmployeeIdNum
      });
      
      if (!shift || shiftEmployeeId !== userEmployeeIdNum) {
        this.logger.log('[AttendanceService] Employee IDs do not match');
        throw new BadRequestException('Nu aveți permisiunea de a modifica această prezență');
      }

      // SECURITATE: Pentru angajați fără attendance.update, permitem doar actualizarea check_out
      // și doar dacă check_out nu a fost deja setat
      if (presence.check_out) {
        this.logger.log('[AttendanceService] Check-out already set, cannot modify');
        throw new BadRequestException('Check-out-ul a fost deja setat și nu poate fi modificat');
      }

      // Verifică dacă încearcă să modifice alte câmpuri decât check_out și total_hours
      // total_hours este permis în request dar va fi ignorat și calculat automat
      const allowedFields = ['check_out', 'total_hours'];
      const attemptedFields = Object.keys(updatePresenceDto).filter(key => updatePresenceDto[key] !== undefined);
      const unauthorizedFields = attemptedFields.filter(field => !allowedFields.includes(field));
      
      this.logger.log('[AttendanceService] Checking allowed fields:', {
        attemptedFields,
        unauthorizedFields,
        allowedFields
      });
      
      if (unauthorizedFields.length > 0) {
        this.logger.log('[AttendanceService] Unauthorized fields detected');
        throw new BadRequestException(`Nu aveți permisiunea de a modifica câmpurile: ${unauthorizedFields.join(', ')}. Puteți modifica doar check_out.`);
      }

      // Ignoră total_hours dacă este trimis - va fi calculat automat mai jos
      delete updatePresenceDto.total_hours;
      this.logger.log('[AttendanceService] Security checks passed, proceeding with update');
    }

    // Validare check-in și check-out
    if (updatePresenceDto.check_in || updatePresenceDto.check_out) {
      const checkInDate = updatePresenceDto.check_in 
        ? new Date(updatePresenceDto.check_in) 
        : presence.check_in;
      const checkOutDate = updatePresenceDto.check_out 
        ? new Date(updatePresenceDto.check_out) 
        : presence.check_out;

      if (checkInDate && checkOutDate && checkInDate >= checkOutDate) {
        throw new BadRequestException('Check-in trebuie să fie înainte de check-out');
      }

      // Recalculează automat orele lucrate dacă ambele sunt setate
      // Ignoră valoarea trimisă de client pentru securitate
      if (checkInDate && checkOutDate) {
        const diffMs = checkOutDate.getTime() - checkInDate.getTime();
        updatePresenceDto.total_hours = diffMs / (1000 * 60 * 60);
      }
    }

    // Asigură conversia la fusul orar corect și pentru update
    if (updatePresenceDto.check_in) {
      updatePresenceDto.check_in = toZonedTime(new Date(updatePresenceDto.check_in), 'Europe/Bucharest') as any;
    }
    
    // Verifică dacă check_out este setat pentru prima dată (programul este finalizat)
    const wasCheckOutSet = !!presence.check_out;
    const isCheckOutBeingSet = !!updatePresenceDto.check_out;
    const isProgramCompleted = !wasCheckOutSet && isCheckOutBeingSet;
    
    if (updatePresenceDto.check_out) {
      updatePresenceDto.check_out = toZonedTime(new Date(updatePresenceDto.check_out), 'Europe/Bucharest') as any;
    }

    Object.assign(presence, updatePresenceDto);
    const savedPresence = await this.presenceRepository.save(presence);

    // Trimite notificare când programul este finalizat pentru prima dată
    if (isProgramCompleted && presence.shift_id) {
      try {
        const shift = await this.findShiftById(presence.shift_id);
        if (shift?.employee_id) {
          // Obține user_id din employee_id prin request HTTP la employees-ms
          let employeeUserId: number | null = null;
          try {
            const employeeResponse = await firstValueFrom(
              this.httpService.get(`http://localhost:3002/employees/${shift.employee_id}`)
            );
            employeeUserId = employeeResponse.data?.user_id || employeeResponse.data?.id || shift.employee_id;
          } catch (error) {
            // Dacă request-ul eșuează, folosim employee_id direct (presupunem că employee_id = user_id pentru angajați)
            console.warn(`[AttendanceService] Nu s-a putut obține user_id pentru employee_id ${shift.employee_id}, folosim employee_id direct`);
            employeeUserId = shift.employee_id;
          }
          
          if (employeeUserId) {
            // Calculează orele lucrate pentru mesaj
            const checkInDate = savedPresence.check_in;
            const checkOutDate = savedPresence.check_out;
            let hoursWorked = 0;
            if (checkInDate && checkOutDate) {
              const diffMs = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
              hoursWorked = diffMs / (1000 * 60 * 60);
            }
            
            const hoursText = hoursWorked > 0 
              ? `${hoursWorked.toFixed(2)} ore` 
              : 'programul';
            
            const locId = (shift as any).work_location_id;
            await this.sendAttendanceNotification(
              'program_finalizat',
              'Program finalizat',
              `Programul tău a fost finalizat cu succes! Ai lucrat ${hoursText}.`,
              employeeUserId,
              {
                presence_id: savedPresence.id,
                shift_id: shift.id,
                check_in: savedPresence.check_in,
                check_out: savedPresence.check_out,
                total_hours: savedPresence.total_hours
              },
              locId,
            );
            
            this.logger.log(`[AttendanceService] Notificare trimisă angajatului ${employeeUserId} (employee_id: ${shift.employee_id}) pentru finalizarea programului`);
          }
        }
      } catch (error) {
        console.error('[AttendanceService] Eroare la trimiterea notificării:', error);
        // Nu aruncăm eroarea - notificarea este opțională
      }
    }

    return savedPresence;
  }

  async deletePresence(
    id: number,
    user?: any,
    authorization?: string,
  ): Promise<void> {
    const presence = await this.findPresenceById(id, user, authorization);

    // Delete all associated inflexions
    for (const inflexion of presence.inflexions) {
      await this.presenceInflexionRepository.remove(inflexion);
    }

    // Delete the presence
    await this.presenceRepository.remove(presence);

    const locId = (presence.shift as any)?.work_location_id;
    await this.sendAttendanceNotification(
      'presence_deleted',
      'Prezenta stearsa',
      `Prezența pentru data de ${presence.date.toLocaleDateString('ro-RO')} a fost ștearsă`,
      presence.shift.employee_id,
      {
        presenceId: presence.id,
        employeeId: presence.shift.employee_id,
        date: presence.date,
      },
      locId,
    );
  }

  // PRESENCE INFLEXION METHODS
  async createPresenceInflexion(createInflexionDto: CreatePresenceInflexionDto): Promise<PresenceInflexion> {
    const { presence_id, timestamp, ...rest } = createInflexionDto;

    const presence = await this.presenceRepository.findOne({
      where: { id: presence_id },
      relations: ['inflexions'],
    });
    if (!presence) {
      throw new NotFoundException(`Prezența cu ID-ul ${presence_id} nu a fost găsită`);
    }

    await this.ensureInflexionsFromLegacy(presence);

    const proposed = this.presenceInflexionRepository.create({
      ...rest,
      presence_id,
      timestamp: toZonedTime(new Date(timestamp), ROMANIA_TZ),
    });

    const next = [...(presence.inflexions ?? []), proposed];
    validateInflexionTimeline(next);

    const saved = await this.presenceInflexionRepository.save(proposed);
    await this.syncPresenceFromInflexions(presence.id);
    return saved;
  }

  async findAllPresenceInflexions(
    page: number = 1,
    limit: number = 10,
    presence_id?: number,
    type?: InflexionType,
  ): Promise<{ data: PresenceInflexion[]; total: number; page: number; limit: number }> {
    const where: any = {};
    if (presence_id) where.presence_id = presence_id;
    if (type) where.type = type;

    const [data, total] = await this.presenceInflexionRepository.findAndCount({
      where,
      relations: ['presence', 'presence.shift'],
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findPresenceInflexionById(
    id: number,
    user?: any,
    authorization?: string,
  ): Promise<PresenceInflexion> {
    const inflexion = await this.presenceInflexionRepository.findOne({
      where: { id },
      relations: ['presence', 'presence.shift'],
    });

    if (!inflexion) {
      throw new NotFoundException(`Punctul de inflexiune cu ID-ul ${id} nu a fost găsit`);
    }

    if (user && inflexion.presence?.shift?.employee_id != null) {
      await this.assertEmployeeAttendanceAccess(
        inflexion.presence.shift.employee_id,
        user,
        authorization,
      );
    }

    return inflexion;
  }

  async updatePresenceInflexion(
    id: number,
    updateInflexionDto: UpdatePresenceInflexionDto,
    user?: any,
    authorization?: string,
  ): Promise<PresenceInflexion> {
    const inflexion = await this.findPresenceInflexionById(id, user, authorization);

    Object.assign(inflexion, updateInflexionDto);
    return await this.presenceInflexionRepository.save(inflexion);
  }

  async deletePresenceInflexion(
    id: number,
    user?: any,
    authorization?: string,
  ): Promise<void> {
    const inflexion = await this.findPresenceInflexionById(id, user, authorization);
    await this.presenceInflexionRepository.remove(inflexion);
  }

  // ACTIVE SHIFT CHECK
  async getActiveShiftForEmployee(employeeId: number): Promise<{
    hasActiveShift: boolean;
    shift: Shift | null;
    presence: Presence | null;
  }> {
    const openPresence = await this.findOpenPresenceForEmployee(employeeId);
    if (!openPresence) {
      return { hasActiveShift: false, shift: null, presence: null };
    }
    return {
      hasActiveShift: true,
      shift: openPresence.shift || null,
      presence: openPresence,
    };
  }

  private async findOpenPresenceForEmployee(
    employeeId: number,
  ): Promise<Presence | null> {
    const presences = await this.presenceRepository
      .createQueryBuilder('presence')
      .innerJoinAndSelect('presence.shift', 'shift')
      .leftJoinAndSelect('presence.inflexions', 'inflexions')
      .where('shift.employee_id = :employeeId', { employeeId })
      .orderBy('presence.date', 'DESC')
      .addOrderBy('presence.check_in', 'DESC')
      .getMany();

    for (const presence of presences) {
      if (this.isPresenceSessionOpen(presence)) {
        return presence;
      }
    }
    return null;
  }

  private isPresenceSessionOpen(presence: Presence): boolean {
    const inflexions = sortInflexions(presence.inflexions ?? []);
    if (inflexions.length > 0) {
      const last = inflexions[inflexions.length - 1];
      return last.type === InflexionType.ENTRY;
    }
    return !!presence.check_in && !presence.check_out;
  }

  private suppliersBaseUrl(): string {
    return (
      process.env.SUPPLIERS_HTTP_URL ||
      process.env.SUPPLIERS_SERVICE_URL ||
      'http://localhost:3007'
    );
  }

  private userAuthHeaders(authorization?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (authorization) {
      headers.Authorization = authorization;
    }
    return headers;
  }

  private internalHeaders(authorization?: string): Record<string, string> {
    const headers: Record<string, string> = this.userAuthHeaders(authorization);
    const secret = process.env.SERVICE_SECRET || '';
    headers['x-internal-service'] = 'attendance-ms';
    headers['x-service-secret'] = secret;
    return headers;
  }

  private serviceOnlyHeaders(): Record<string, string> {
    const secret = process.env.SERVICE_SECRET || '';
    return {
      'x-internal-service': 'attendance-ms',
      'x-service-secret': secret,
    };
  }

  async fetchSupplierStaffEmployeeIds(
    authorization?: string,
  ): Promise<number[]> {
    const base = this.suppliersBaseUrl();
    const headers = this.userAuthHeaders(authorization);
    try {
      const myResp = await firstValueFrom(
        this.httpService.get(`${base}/suppliers/my-supplier`, {
          headers,
          timeout: 8000,
        }),
      );
      const supplierId = Number(myResp.data?.id);
      if (!Number.isFinite(supplierId) || supplierId <= 0) {
        return [];
      }
      const [driversResp, warehouseResp] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${base}/suppliers/${supplierId}/drivers`, {
            headers,
            timeout: 8000,
          }),
        ),
        firstValueFrom(
          this.httpService.get(`${base}/suppliers/${supplierId}/warehouse`, {
            headers,
            timeout: 8000,
          }),
        ),
      ]);
      const ids = new Set<number>();
      for (const row of [...(driversResp.data ?? []), ...(warehouseResp.data ?? [])]) {
        const id = Number(row?.employee_id);
        if (Number.isFinite(id) && id > 0) {
          ids.add(id);
        }
      }
      return [...ids];
    } catch (error: any) {
      console.warn(
        `[AttendanceService] fetchSupplierStaffEmployeeIds failed: ${error?.message || error}`,
      );
      return [];
    }
  }

  private buildIntervalsFromPresence(presence: Presence): Array<{
    entry_inflexion_id: number | null;
    exit_inflexion_id: number | null;
    entry_at: string;
    exit_at: string | null;
    duration_minutes: number | null;
    incomplete: boolean;
  }> {
    const inflexions = sortInflexions(presence.inflexions ?? []);
    const intervals: Array<{
      entry_inflexion_id: number | null;
      exit_inflexion_id: number | null;
      entry_at: string;
      exit_at: string | null;
      duration_minutes: number | null;
      incomplete: boolean;
    }> = [];

    if (inflexions.length === 0) {
      if (presence.check_in) {
        const entryMs = new Date(presence.check_in).getTime();
        const exitMs = presence.check_out
          ? new Date(presence.check_out).getTime()
          : null;
        intervals.push({
          entry_inflexion_id: null,
          exit_inflexion_id: null,
          entry_at: new Date(presence.check_in).toISOString(),
          exit_at: presence.check_out
            ? new Date(presence.check_out).toISOString()
            : null,
          duration_minutes:
            exitMs != null
              ? Math.round((exitMs - entryMs) / 60000)
              : null,
          incomplete: exitMs == null,
        });
      }
      return intervals;
    }

    let openEntry: { ts: Date; id: number } | null = null;
    for (const inf of inflexions) {
      const ts = new Date(inf.timestamp);
      if (inf.type === InflexionType.ENTRY) {
        openEntry = { ts, id: inf.id };
      } else if (inf.type === InflexionType.EXIT && openEntry) {
        intervals.push({
          entry_inflexion_id: openEntry.id,
          exit_inflexion_id: inf.id,
          entry_at: openEntry.ts.toISOString(),
          exit_at: ts.toISOString(),
          duration_minutes: Math.round(
            (ts.getTime() - openEntry.ts.getTime()) / 60000,
          ),
          incomplete: false,
        });
        openEntry = null;
      }
    }
    if (openEntry) {
      intervals.push({
        entry_inflexion_id: openEntry.id,
        exit_inflexion_id: null,
        entry_at: openEntry.ts.toISOString(),
        exit_at: null,
        duration_minutes: null,
        incomplete: true,
      });
    }
    return intervals;
  }

  private sumIntervalMinutes(
    intervals: Array<{ duration_minutes: number | null }>,
  ): number {
    return intervals.reduce(
      (sum, row) => sum + (row.duration_minutes ?? 0),
      0,
    );
  }

  private aggregatePresenceDaysByDate(
    presences: Presence[],
    openPresence: Presence | null,
  ): Array<{
    date: string;
    presence_id: number;
    intervals: ReturnType<AttendanceService['buildIntervalsFromPresence']>;
    day_total_minutes: number;
    day_total_label: string;
    has_open_session: boolean;
    correction_notes: string | null;
  }> {
    const byDate = new Map<
      string,
      {
        date: string;
        presence_id: number;
        intervals: ReturnType<AttendanceService['buildIntervalsFromPresence']>;
        has_open_session: boolean;
        correction_notes: string | null;
      }
    >();

    for (const presence of presences) {
      const date = format(new Date(presence.date), 'yyyy-MM-dd');
      const intervals = this.buildIntervalsFromPresence(presence);
      const hasOpen =
        openPresence?.id === presence.id &&
        this.isPresenceSessionOpen(presence);
      const notes = extractCorrectionReasons(presence.notes);
      const existing = byDate.get(date);

      if (!existing) {
        byDate.set(date, {
          date,
          presence_id: presence.id,
          intervals: [...intervals],
          has_open_session: hasOpen,
          correction_notes: notes,
        });
        continue;
      }

      existing.intervals.push(...intervals);
      existing.has_open_session = existing.has_open_session || hasOpen;
      if (notes) {
        existing.correction_notes = existing.correction_notes
          ? `${existing.correction_notes}; ${notes}`
          : notes;
      }
    }

    return Array.from(byDate.values())
      .map((day) => {
        day.intervals.sort(
          (a, b) =>
            new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime(),
        );
        const day_total_minutes = this.sumIntervalMinutes(day.intervals);
        return {
          ...day,
          day_total_minutes,
          day_total_label: this.formatMinutes(day_total_minutes),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private formatMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  private async ensureDailyShift(
    employeeId: number,
    workLocationId: number,
    dateRo: string,
  ): Promise<Shift> {
    const dayStart = toZonedTime(
      new Date(`${dateRo}T00:00:00`),
      ROMANIA_TZ,
    );
    const dayEnd = toZonedTime(
      new Date(`${dateRo}T23:59:59`),
      ROMANIA_TZ,
    );

    let shift = await this.shiftRepository.findOne({
      where: {
        employee_id: employeeId,
        work_location_id: workLocationId,
      },
      order: { start_datetime: 'DESC' },
    });

    const shiftStart = shift ? new Date(shift.start_datetime) : null;
    const sameDay =
      shiftStart &&
      formatInTimeZone(shiftStart, ROMANIA_TZ, 'yyyy-MM-dd') === dateRo;

    if (!shift || !sameDay) {
      shift = this.shiftRepository.create({
        employee_id: employeeId,
        work_location_id: workLocationId,
        department_id: 1,
        position_id: null,
        start_datetime: dayStart,
        end_datetime: dayEnd,
        time_for_checkout: 0,
        notes: 'auto_daily_shift',
      });
      shift = await this.shiftRepository.save(shift);
    }
    return shift;
  }

  private async ensureDailyPresence(
    shiftId: number,
    dateRo: string,
  ): Promise<Presence> {
    const dateNorm = this.normalizeDateOnly(dateRo);
    let presence = await this.presenceRepository.findOne({
      where: { shift_id: shiftId, date: dateNorm },
      relations: ['inflexions'],
    });
    if (!presence) {
      presence = this.presenceRepository.create({
        shift_id: shiftId,
        date: dateNorm,
        status: PresenceStatus.PRESENT_FULL,
      });
      presence = await this.presenceRepository.save(presence);
      presence.inflexions = [];
    }
    return presence;
  }

  async myPunch(user: any): Promise<{
    action: 'entry' | 'exit';
    presence: Presence;
    intervals: Array<{
      entry_inflexion_id: number | null;
      exit_inflexion_id: number | null;
      entry_at: string;
      exit_at: string | null;
      duration_minutes: number | null;
      incomplete: boolean;
    }>;
    day_total_minutes: number;
    day_total_label: string;
  }> {
    const employeeId = assertOperationalSelfService(user);
    const ctx: AttendanceUserContext = {
      ...buildAttendanceUserContext(user),
      employeeId,
    };

    const prev = this.punchGateByEmployee.get(employeeId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.punchGateByEmployee.set(employeeId, prev.then(() => gate));
    await prev;
    try {
      return await this.myPunchInternal(user, ctx);
    } finally {
      release();
    }
  }

  private async myPunchInternal(
    user: any,
    ctx: AttendanceUserContext,
  ): Promise<{
    action: 'entry' | 'exit';
    presence: Presence;
    intervals: Array<{
      entry_inflexion_id: number | null;
      exit_inflexion_id: number | null;
      entry_at: string;
      exit_at: string | null;
      duration_minutes: number | null;
      incomplete: boolean;
    }>;
    day_total_minutes: number;
    day_total_label: string;
  }> {
    const workLocationId = Number(
      user?.work_location_id ?? user?.work_location_default_id,
    );
    if (!Number.isFinite(workLocationId) || workLocationId <= 0) {
      throw new BadRequestException(
        'Locația de lucru lipsește din profilul angajatului',
      );
    }

    const now = new Date();
    const nowRo = toZonedTime(now, ROMANIA_TZ);
    const dateRo = formatInTimeZone(nowRo, ROMANIA_TZ, 'yyyy-MM-dd');

    const openPresence = await this.findOpenPresenceForEmployee(ctx.employeeId);
    if (openPresence) {
      const openEntry = findOpenEntryInflexion(openPresence.inflexions ?? []);
      let exitTimestamp = nowRo;
      if (openEntry) {
        const entryMs = new Date(openEntry.timestamp).getTime();
        const entrySec = Math.floor(entryMs / 1000);
        let exitSec = Math.floor(exitTimestamp.getTime() / 1000);
        if (exitSec <= entrySec) {
          exitTimestamp = new Date((entrySec + 1) * 1000);
        }
      }
      const inflexion = this.presenceInflexionRepository.create({
        presence_id: openPresence.id,
        type: InflexionType.EXIT,
        timestamp: exitTimestamp,
      });
      await this.presenceInflexionRepository.save(inflexion);
      await this.syncPresenceFromInflexions(openPresence.id);
      const reloaded = await this.presenceRepository.findOne({
        where: { id: openPresence.id },
        relations: ['inflexions', 'shift'],
      });
      if (!reloaded) {
        throw new NotFoundException('Prezența nu a fost găsită după ieșire');
      }
      const intervals = this.buildIntervalsFromPresence(reloaded);
      return {
        action: 'exit',
        presence: reloaded,
        intervals,
        day_total_minutes: this.sumIntervalMinutes(intervals),
        day_total_label: this.formatMinutes(this.sumIntervalMinutes(intervals)),
      };
    }

    const shift = await this.ensureDailyShift(
      ctx.employeeId,
      workLocationId,
      dateRo,
    );
    let presence = await this.ensureDailyPresence(shift.id, dateRo);
    presence = await this.presenceRepository.findOne({
      where: { id: presence.id },
      relations: ['inflexions'],
    });
    if (!presence) {
      throw new NotFoundException('Prezența zilnică nu a fost găsită');
    }
    const openEntry = findOpenEntryInflexion(presence.inflexions ?? []);
    if (openEntry) {
      throw new BadRequestException(
        'Există deja o intrare deschisă — ieșirea este obligatorie înainte de o nouă intrare',
      );
    }
    let entryTimestamp = nowRo;
    const sorted = sortInflexions(presence.inflexions ?? []);
    const last = sorted[sorted.length - 1];
    if (last?.type === InflexionType.EXIT) {
      const lastExitSec = Math.floor(new Date(last.timestamp).getTime() / 1000);
      const entrySec = Math.floor(entryTimestamp.getTime() / 1000);
      if (entrySec <= lastExitSec) {
        entryTimestamp = new Date((lastExitSec + 1) * 1000);
      }
    }
    const entryInflexion = this.presenceInflexionRepository.create({
      presence_id: presence.id,
      type: InflexionType.ENTRY,
      timestamp: entryTimestamp,
    });
    await this.presenceInflexionRepository.save(entryInflexion);
    await this.syncPresenceFromInflexions(presence.id);
    const reloaded = await this.presenceRepository.findOne({
      where: { id: presence.id },
      relations: ['inflexions', 'shift'],
    });
    if (!reloaded) {
      throw new NotFoundException('Prezența nu a fost găsită după intrare');
    }
    const intervals = this.buildIntervalsFromPresence(reloaded);
    return {
      action: 'entry',
      presence: reloaded,
      intervals,
      day_total_minutes: this.sumIntervalMinutes(intervals),
      day_total_label: this.formatMinutes(this.sumIntervalMinutes(intervals)),
    };
  }

  async getMyTimesheet(
    user: any,
    start_date?: string,
    end_date?: string,
  ): Promise<{
    employee_id: number;
    days: Array<{
      date: string;
      intervals: Array<{
        entry_at: string;
        exit_at: string | null;
        duration_minutes: number | null;
        incomplete: boolean;
      }>;
      day_total_minutes: number;
      day_total_label: string;
      has_open_session: boolean;
      correction_notes: string | null;
    }>;
    period_total_minutes: number;
    period_total_label: string;
    active_session: {
      presence_id: number;
      entry_at: string;
      date: string;
    } | null;
  }> {
    const employeeId = assertOperationalSelfService(user);
    const ctx: AttendanceUserContext = {
      ...buildAttendanceUserContext(user),
      employeeId,
    };
    return this.buildTimesheetForEmployee(
      employeeId,
      start_date,
      end_date,
      ctx,
    );
  }

  /**
   * Aduce ID-urile angajaților activi din aceeași locație ca și utilizatorul curent.
   * Folosit pentru scope-ul de citire al operaționalilor (magazioner/șofer).
   * Sursa: GET /employees/for-own?location_id=<JWT.work_location_id> (intern, fără JWT).
   */
  async fetchOperationalColleagueIds(user: any): Promise<number[]> {
    const selfId = Number(user?.sub ?? user?.employee_id ?? user?.id_employee);
    const locationId = Number(
      user?.work_location_id ?? user?.work_location_default_id,
    );
    if (!Number.isFinite(locationId) || locationId <= 0) {
      throw new ForbiddenException(
        'Locația de lucru nu este configurată în tokenul de autentificare',
      );
    }
    // Apel intern direct la employees-ms (evită gateway-ul care cere JWT)
    const base =
      process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3011';
    const resp = await firstValueFrom(
      this.httpService.get(`${base}/employees/for-own`, {
        params: { location_id: locationId },
        headers: {
          'x-internal-service': 'attendance',
          'x-service-secret':
            process.env.SERVICE_SECRET || '',
        },
        timeout: 8000,
      }),
    );
    const list: { id: number }[] = Array.isArray(resp.data) ? resp.data : [];
    const ids = list
      .map((e) => Number(e.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (Number.isFinite(selfId) && selfId > 0 && !ids.includes(selfId)) {
      ids.push(selfId);
    }
    return ids;
  }

  async getTeamTimesheet(
    user: any,
    authorization: string | undefined,
    filters: {
      employee_id?: number;
      work_location_id?: number;
      start_date?: string;
      end_date?: string;
    },
  ) {
    if (isOperationalStaffUser(user)) {
      // Operaționalii pot citi pontajul colegilor din aceeași locație — doar citire.
      const selfId = Number(user?.sub ?? user?.employee_id);
      const colleagueIds = await this.fetchOperationalColleagueIds(user);
      const ctx = buildAttendanceUserContext(user);

      // Dacă se cere un anumit angajat, verifică că este în scope
      if (filters.employee_id != null) {
        const targetId = Number(filters.employee_id);
        if (!colleagueIds.includes(targetId)) {
          throw new ForbiddenException(
            'Angajatul nu face parte din aceeași locație de lucru',
          );
        }
        const sheet = await this.buildTimesheetForEmployee(
          targetId,
          filters.start_date,
          filters.end_date,
          ctx,
          colleagueIds,
        );
        return { employees: [sheet], ...this.sumPeriodFromSheets([sheet]) };
      }

      // Fără filtru explicit → toți colegii din locație (sau locația din JWT)
      const locationId = Number(
        filters.work_location_id ??
          user?.work_location_id ??
          user?.work_location_default_id,
      );
      const idsToFetch = locationId > 0
        ? colleagueIds // deja filtrate după locație
        : [selfId];

      const employees = [];
      for (const employeeId of idsToFetch) {
        if (!Number.isFinite(employeeId) || employeeId <= 0) continue;
        employees.push(
          await this.buildTimesheetForEmployee(
            employeeId,
            filters.start_date,
            filters.end_date,
            ctx,
            colleagueIds,
          ),
        );
      }
      return { employees, ...this.sumPeriodFromSheets(employees) };
    }

    const ctx = buildAttendanceUserContext(user);
    if (!isFurnizorTenant(ctx) && !hasAttendanceManagePermission(ctx.permissions)) {
      throw new ForbiddenException(
        'Doar furnizorul sau managerii pot vizualiza pontajul echipei',
      );
    }

    let allowedEmployeeIds: number[] | undefined;
    if (isFurnizorTenant(ctx) && !hasAttendanceManagePermission(ctx.permissions)) {
      allowedEmployeeIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (allowedEmployeeIds.length === 0) {
        return { employees: [], period_total_minutes: 0, period_total_label: '0m' };
      }
    }

    if (filters.employee_id != null) {
      const targetId = Number(filters.employee_id);
      if (isFurnizorTenant(ctx) && !hasAttendanceManagePermission(ctx.permissions)) {
        await this.assertFurnizorStaffMember(targetId, ctx, authorization);
      } else if (
        allowedEmployeeIds &&
        !allowedEmployeeIds.includes(targetId)
      ) {
        throw new ForbiddenException(
          'Angajatul nu aparține furnizorului autentificat',
        );
      }
      const sheet = await this.buildTimesheetForEmployee(
        targetId,
        filters.start_date,
        filters.end_date,
        ctx,
        allowedEmployeeIds,
      );
      return { employees: [sheet], ...this.sumPeriodFromSheets([sheet]) };
    }

    const employeeIds =
      allowedEmployeeIds ??
      (await this.distinctEmployeeIdsForLocation(filters.work_location_id));

    const employees = [];
    for (const employeeId of employeeIds) {
      employees.push(
        await this.buildTimesheetForEmployee(
          employeeId,
          filters.start_date,
          filters.end_date,
          ctx,
          allowedEmployeeIds,
        ),
      );
    }
    return { employees, ...this.sumPeriodFromSheets(employees) };
  }

  private async distinctEmployeeIdsForLocation(
    workLocationId?: number,
  ): Promise<number[]> {
    const qb = this.shiftRepository
      .createQueryBuilder('shift')
      .select('DISTINCT shift.employee_id', 'employee_id');
    if (workLocationId != null && Number.isFinite(workLocationId)) {
      qb.where('shift.work_location_id = :workLocationId', { workLocationId });
    }
    const rows = await qb.getRawMany();
    return rows
      .map((r) => Number(r.employee_id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private sumPeriodFromSheets(
    sheets: Array<{ period_total_minutes: number }>,
  ): { period_total_minutes: number; period_total_label: string } {
    const period_total_minutes = sheets.reduce(
      (sum, s) => sum + (s.period_total_minutes ?? 0),
      0,
    );
    return {
      period_total_minutes,
      period_total_label: this.formatMinutes(period_total_minutes),
    };
  }

  private async buildTimesheetForEmployee(
    employeeId: number,
    start_date: string | undefined,
    end_date: string | undefined,
    ctx: AttendanceUserContext,
    allowedEmployeeIds?: number[],
  ) {
    assertEmployeeSelfOrManager(ctx, employeeId, allowedEmployeeIds);

    const end =
      end_date ??
      formatInTimeZone(new Date(), ROMANIA_TZ, 'yyyy-MM-dd');
    const start =
      start_date ??
      formatInTimeZone(
        new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        ROMANIA_TZ,
        'yyyy-MM-dd',
      );

    const presences = await this.presenceRepository
      .createQueryBuilder('presence')
      .innerJoinAndSelect('presence.shift', 'shift')
      .leftJoinAndSelect('presence.inflexions', 'inflexions')
      .where('shift.employee_id = :employeeId', { employeeId })
      .andWhere('presence.date BETWEEN :start AND :end', {
        start,
        end,
      })
      .orderBy('presence.date', 'ASC')
      .getMany();

    const openPresence = await this.findOpenPresenceForEmployee(employeeId);
    const days = this.aggregatePresenceDaysByDate(presences, openPresence);

    const period_total_minutes = days.reduce(
      (sum, d) => sum + d.day_total_minutes,
      0,
    );

    let active_session: {
      presence_id: number;
      entry_at: string;
      date: string;
    } | null = null;
    if (openPresence) {
      const intervals = this.buildIntervalsFromPresence(openPresence);
      const lastOpen = intervals.find((i) => i.incomplete);
      if (lastOpen) {
        active_session = {
          presence_id: openPresence.id,
          entry_at: lastOpen.entry_at,
          date: format(new Date(openPresence.date), 'yyyy-MM-dd'),
        };
      }
    }

    return {
      employee_id: employeeId,
      days,
      period_total_minutes,
      period_total_label: this.formatMinutes(period_total_minutes),
      active_session,
    };
  }

  private async getCurrentSupplierId(
    authorization?: string,
  ): Promise<number | null> {
    const base = this.suppliersBaseUrl();
    const headers = this.userAuthHeaders(authorization);
    try {
      const myResp = await firstValueFrom(
        this.httpService.get(`${base}/suppliers/my-supplier`, {
          headers,
          timeout: 8000,
        }),
      );
      const supplierId = Number(myResp.data?.id);
      return Number.isFinite(supplierId) && supplierId > 0 ? supplierId : null;
    } catch {
      return null;
    }
  }

  private async assertFurnizorStaffMember(
    employeeId: number,
    ctx: AttendanceUserContext,
    authorization?: string,
  ): Promise<void> {
    if (!isFurnizorTenant(ctx)) {
      return;
    }
    if (ctx.companyId == null || ctx.companyId <= 0) {
      throw new ForbiddenException(
        'Furnizorul nu a putut fi determinat din JWT',
      );
    }

    const supplierId = await this.getCurrentSupplierId(authorization);
    if (!supplierId) {
      throw new ForbiddenException('Contul furnizorului nu este autorizat');
    }

    const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
    if (!staffIds.includes(employeeId)) {
      throw new ForbiddenException(
        'Angajatul nu aparține furnizorului autentificat',
      );
    }

    const base = this.suppliersBaseUrl();
    const internalOnly = this.serviceOnlyHeaders();
    try {
      const resp = await firstValueFrom(
        this.httpService.get(
          `${base}/suppliers/internal/employees/${employeeId}/supplier-ids`,
          { headers: internalOnly, timeout: 8000 },
        ),
      );
      const supplierIds: number[] = Array.isArray(resp.data?.supplier_ids)
        ? resp.data.supplier_ids.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
        : [];
      if (supplierIds.length !== 1 || supplierIds[0] !== supplierId) {
        throw new ForbiddenException(
          'Angajatul aparține altui furnizor sau are asocieri multiple',
        );
      }
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(
        'Nu s-a putut verifica apartenența angajatului la furnizor',
      );
    }
  }

  private async assertFurnizorCanCorrectEmployee(
    employeeId: number,
    ctx: AttendanceUserContext,
    authorization?: string,
  ): Promise<void> {
    return this.assertFurnizorStaffMember(employeeId, ctx, authorization);
  }

  private async ensureInflexionsFromLegacy(presence: Presence): Promise<void> {
    if (presence.inflexions?.length) {
      return;
    }
    if (!presence.check_in) {
      return;
    }
    await this.presenceInflexionRepository.save(
      this.presenceInflexionRepository.create({
        presence_id: presence.id,
        type: InflexionType.ENTRY,
        timestamp: presence.check_in,
      }),
    );
    if (presence.check_out) {
      await this.presenceInflexionRepository.save(
        this.presenceInflexionRepository.create({
          presence_id: presence.id,
          type: InflexionType.EXIT,
          timestamp: presence.check_out,
        }),
      );
    }
    presence.inflexions = await this.presenceInflexionRepository.find({
      where: { presence_id: presence.id },
    });
  }

  private async syncPresenceFromInflexions(presenceId: number): Promise<Presence> {
    const presence = await this.presenceRepository.findOne({
      where: { id: presenceId },
      relations: ['inflexions', 'shift'],
    });
    if (!presence) {
      throw new NotFoundException(`Prezența cu ID-ul ${presenceId} nu a fost găsită`);
    }

    const inflexions = sortInflexions(presence.inflexions ?? []);
    if (inflexions.length === 0) {
      presence.total_hours = 0;
      return this.presenceRepository.save(presence);
    }

    validateInflexionTimeline(inflexions);

    const firstEntry = inflexions.find((i) => i.type === InflexionType.ENTRY);
    presence.check_in = firstEntry ? firstEntry.timestamp : null;

    const openEntry = findOpenEntryInflexion(inflexions);
    if (openEntry) {
      presence.check_out = null;
    } else {
      const lastExit = [...inflexions]
        .reverse()
        .find((i) => i.type === InflexionType.EXIT);
      presence.check_out = lastExit?.timestamp ?? null;
    }

    const totalMinutes = buildClosedIntervalMinutes(inflexions);
    presence.total_hours = totalMinutes / 60;
    return this.presenceRepository.save(presence);
  }

  async correctPresence(
    presenceId: number,
    dto: CorrectPresenceDto,
    user: any,
    authorization?: string,
  ): Promise<Presence> {
    const ctx = buildAttendanceUserContext(user);

    if (isOperationalEmployee(ctx) && !canCorrectAttendance(ctx)) {
      throw new ForbiddenException('Angajații nu pot corecta pontajul');
    }
    if (!canCorrectAttendance(ctx)) {
      throw new ForbiddenException(
        'Nu aveți permisiunea de a corecta pontajul',
      );
    }
    if (!dto.correction_reason?.trim()) {
      throw new BadRequestException('Motivul corecției este obligatoriu');
    }

    const presence = await this.findPresenceById(presenceId);
    const employeeId = presence.shift?.employee_id;
    if (!employeeId) {
      throw new BadRequestException('Prezența nu are angajat asociat');
    }

    if (isAdminOrSuperAdmin(ctx) && hasAttendanceManagePermission(ctx.permissions)) {
      // admin/superadmin cu attendance.update
    } else if (isFurnizorTenant(ctx)) {
      await this.assertFurnizorCanCorrectEmployee(
        employeeId,
        ctx,
        authorization,
      );
    } else {
      throw new ForbiddenException(
        'Nu aveți permisiunea de a corecta pontajul',
      );
    }

    await this.ensureInflexionsFromLegacy(presence);
    const reloaded = await this.findPresenceById(presenceId);
    const inflexions = sortInflexions(reloaded.inflexions ?? []);

    const oldValues: Record<string, unknown> = {
      intervals: this.buildIntervalsFromPresence(reloaded),
      total_hours: reloaded.total_hours,
    };

    const toTs = (iso: string) =>
      toZonedTime(new Date(iso), ROMANIA_TZ) as Date;

    switch (dto.action) {
      case PresenceCorrectionAction.UPDATE_ENTRY: {
        if (!dto.inflexion_id || !dto.timestamp) {
          throw new BadRequestException(
            'inflexion_id și timestamp sunt obligatorii pentru update_entry',
          );
        }
        const inf = inflexions.find((i) => i.id === dto.inflexion_id);
        if (!inf || inf.type !== InflexionType.ENTRY) {
          throw new BadRequestException('Inflexion intrare invalid');
        }
        inf.timestamp = toTs(dto.timestamp);
        await this.presenceInflexionRepository.save(inf);
        break;
      }
      case PresenceCorrectionAction.UPDATE_EXIT: {
        if (!dto.inflexion_id || !dto.timestamp) {
          throw new BadRequestException(
            'inflexion_id și timestamp sunt obligatorii pentru update_exit',
          );
        }
        const inf = inflexions.find((i) => i.id === dto.inflexion_id);
        if (!inf || inf.type !== InflexionType.EXIT) {
          throw new BadRequestException('Inflexion ieșire invalid');
        }
        inf.timestamp = toTs(dto.timestamp);
        await this.presenceInflexionRepository.save(inf);
        break;
      }
      case PresenceCorrectionAction.ADD_MISSING_EXIT: {
        if (!dto.timestamp) {
          throw new BadRequestException(
            'timestamp este obligatoriu pentru add_missing_exit',
          );
        }
        const openEntry = findOpenEntryInflexion(inflexions);
        if (!openEntry) {
          throw new BadRequestException('Nu există intrare deschisă');
        }
        if (
          dto.inflexion_id != null &&
          dto.inflexion_id !== openEntry.id
        ) {
          throw new BadRequestException(
            'inflexion_id nu corespunde intrării deschise',
          );
        }
        await this.presenceInflexionRepository.save(
          this.presenceInflexionRepository.create({
            presence_id: presenceId,
            type: InflexionType.EXIT,
            timestamp: toTs(dto.timestamp),
          }),
        );
        break;
      }
      case PresenceCorrectionAction.ADD_INTERVAL: {
        if (!dto.entry_at || !dto.exit_at) {
          throw new BadRequestException(
            'entry_at și exit_at sunt obligatorii pentru add_interval',
          );
        }
        const entryTs = toTs(dto.entry_at);
        const exitTs = toTs(dto.exit_at);
        if (exitTs <= entryTs) {
          throw new BadRequestException(
            'Ieșirea trebuie să fie după intrare',
          );
        }
        await this.presenceInflexionRepository.save(
          this.presenceInflexionRepository.create({
            presence_id: presenceId,
            type: InflexionType.ENTRY,
            timestamp: entryTs,
          }),
        );
        await this.presenceInflexionRepository.save(
          this.presenceInflexionRepository.create({
            presence_id: presenceId,
            type: InflexionType.EXIT,
            timestamp: exitTs,
          }),
        );
        break;
      }
      case PresenceCorrectionAction.DELETE_INTERVAL: {
        if (!dto.entry_inflexion_id || !dto.exit_inflexion_id) {
          throw new BadRequestException(
            'entry_inflexion_id și exit_inflexion_id sunt obligatorii pentru delete_interval',
          );
        }
        const entryInf = inflexions.find(
          (i) => i.id === dto.entry_inflexion_id && i.type === InflexionType.ENTRY,
        );
        const exitInf = inflexions.find(
          (i) => i.id === dto.exit_inflexion_id && i.type === InflexionType.EXIT,
        );
        if (!entryInf || !exitInf) {
          throw new BadRequestException('Perechea de inflexiuni nu a fost găsită');
        }
        await this.presenceInflexionRepository.remove(exitInf);
        await this.presenceInflexionRepository.remove(entryInf);
        break;
      }
      default:
        throw new BadRequestException('Acțiune de corecție necunoscută');
    }

    const saved = await this.syncPresenceFromInflexions(presenceId);
    const newValues: Record<string, unknown> = {
      intervals: this.buildIntervalsFromPresence(saved),
      total_hours: saved.total_hours,
    };

    saved.notes = appendCorrectionAudit(saved.notes, {
      action: dto.action,
      corrected_by: ctx.employeeId ?? user?.userId ?? user?.sub ?? null,
      corrected_at: new Date().toISOString(),
      correction_reason: dto.correction_reason.trim(),
      old_values: oldValues,
      new_values: newValues,
    });

    return this.presenceRepository.save(saved);
  }

  // STATISTICS AND REPORTS
  async getAttendanceStatistics(
    employee_id?: number,
    start_date?: string,
    end_date?: string,
  ): Promise<any> {
    const where: any = {};
    if (employee_id) where.shift_id = employee_id;

    if (start_date && end_date) {
      where.date = Between(new Date(start_date), new Date(end_date));
    }

    const [totalPresences, presentFull, presentPartial, absent] = await Promise.all([
      this.presenceRepository.count({ where }),
      this.presenceRepository.count({ where: { ...where, status: PresenceStatus.PRESENT_FULL } }),
      this.presenceRepository.count({ where: { ...where, status: PresenceStatus.PRESENT_PARTIAL } }),
      this.presenceRepository.count({ where: { ...where, status: PresenceStatus.ABSENT } }),
    ]);

    const totalHours = await this.presenceRepository
      .createQueryBuilder('presence')
      .select('SUM(presence.total_hours)', 'total')
      .where(where)
      .getRawOne();

    return {
      totalPresences,
      presentFull,
      presentPartial,
      absent,
      totalHours: totalHours?.total || 0,
      attendanceRate: totalPresences > 0 ? ((presentFull + presentPartial) / totalPresences) * 100 : 0,
    };
  }
}

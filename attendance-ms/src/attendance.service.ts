import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit, Inject } from '@nestjs/common';
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
        this.httpService.post('http://giurom.bitap.ro:3002/tasks/executions/daily-points', {
          employee_id: employeeId,
          total_points: points,
          work_date: workDate,
          location_id: locationId,
        })
      );
      console.log(`✅ Added ${points} points to employee ${employeeId}: ${reason}`);
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
  ): Promise<{ data: Shift[]; total: number; page: number; limit: number }> {
    const where: any = {};
    if (employee_id) where.employee_id = employee_id;
    if (work_location_id) where.work_location_id = work_location_id;
    if (department_id) where.department_id = department_id;

    const [data, total] = await this.shiftRepository.findAndCount({
      where,
      relations: ['presences'],
      skip: (page - 1) * limit,
      take: limit,
      order: { start_datetime: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findShiftById(id: number): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['presences'],
    });

    if (!shift) {
      throw new NotFoundException(`Schimbul cu ID-ul ${id} nu a fost găsit`);
    }

    return shift;
  }

  async updateShift(id: number, updateShiftDto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findShiftById(id);

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

  async deleteShift(id: number): Promise<void> {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['presences'],
    });

    if (!shift) {
      throw new NotFoundException(`Schimbul cu ID-ul ${id} nu a fost găsit`);
    }

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

      console.log(
        `🕐 [Punctualitate] check_in=${new Date(checkInInstantMs).toISOString()} zi_RO=${ymdRo} shift_start=${new Date(shiftStartMs).toISOString()}`,
      );
      console.log(
        `🕐 [Punctualitate] lead până la start (ms)=${earlyLeadMs}, prag: ${minimumLeadTimeMs}`,
      );

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
        console.log(
          `⏰ Check-in pentru angajat ${shift.employee_id} nu respectă pragul de 1 oră înainte de start-ul turei – nu se acordă puncte`,
        );
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
      
      console.log(`🕐 Auto-checkout calculat: ${autoCheckout.toISOString()} (din shift.end_datetime: ${shift.end_datetime} + ${timeForCheckout} minute, check_in: ${check_in})`);
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

  async findPresenceById(id: number): Promise<Presence> {
    const presence = await this.presenceRepository.findOne({
      where: { id },
      relations: ['shift', 'inflexions'],
    });

    if (!presence) {
      throw new NotFoundException(`Prezența cu ID-ul ${id} nu a fost găsită`);
    }

    return presence;
  }

  async updatePresence(id: number, updatePresenceDto: UpdatePresenceDto, user?: any): Promise<Presence> {
    const presence = await this.findPresenceById(id);

    console.log('[AttendanceService] updatePresence called:', {
      presenceId: id,
      presenceShiftId: presence?.shift_id,
      presenceCheckOut: presence?.check_out,
      updateData: updatePresenceDto,
      user: user ? { userId: user.userId, permissions: user.permissions } : null
    });

    // Verifică dacă utilizatorul are permisiunea attendance.update
    const hasUpdatePermission = user?.permissions?.includes('attendance.update') || false;
    
    // Dacă utilizatorul nu are permisiunea, verifică dacă prezența aparține angajatului
    if (!hasUpdatePermission) {
      // Verifică dacă prezența aparține angajatului prin shift
      const userEmployeeId = user?.userId || user?.id || user?.employee_id || user?.id_employee || user?.sub;
      
      console.log('[AttendanceService] No update permission, checking ownership:', {
        userEmployeeId,
        presenceShiftId: presence?.shift_id
      });
      
      if (!presence?.shift_id || !userEmployeeId) {
        console.log('[AttendanceService] Missing shift_id or userEmployeeId');
        throw new BadRequestException('Nu aveți permisiunea de a modifica această prezență');
      }
      
      const shift = await this.findShiftById(presence.shift_id);
      const shiftEmployeeId = Number(shift?.employee_id);
      const userEmployeeIdNum = Number(userEmployeeId);
      
      console.log('[AttendanceService] Comparing employee IDs:', {
        shiftEmployeeId,
        userEmployeeIdNum,
        match: shiftEmployeeId === userEmployeeIdNum
      });
      
      if (!shift || shiftEmployeeId !== userEmployeeIdNum) {
        console.log('[AttendanceService] Employee IDs do not match');
        throw new BadRequestException('Nu aveți permisiunea de a modifica această prezență');
      }

      // SECURITATE: Pentru angajați fără attendance.update, permitem doar actualizarea check_out
      // și doar dacă check_out nu a fost deja setat
      if (presence.check_out) {
        console.log('[AttendanceService] Check-out already set, cannot modify');
        throw new BadRequestException('Check-out-ul a fost deja setat și nu poate fi modificat');
      }

      // Verifică dacă încearcă să modifice alte câmpuri decât check_out și total_hours
      // total_hours este permis în request dar va fi ignorat și calculat automat
      const allowedFields = ['check_out', 'total_hours'];
      const attemptedFields = Object.keys(updatePresenceDto).filter(key => updatePresenceDto[key] !== undefined);
      const unauthorizedFields = attemptedFields.filter(field => !allowedFields.includes(field));
      
      console.log('[AttendanceService] Checking allowed fields:', {
        attemptedFields,
        unauthorizedFields,
        allowedFields
      });
      
      if (unauthorizedFields.length > 0) {
        console.log('[AttendanceService] Unauthorized fields detected');
        throw new BadRequestException(`Nu aveți permisiunea de a modifica câmpurile: ${unauthorizedFields.join(', ')}. Puteți modifica doar check_out.`);
      }

      // Ignoră total_hours dacă este trimis - va fi calculat automat mai jos
      delete updatePresenceDto.total_hours;
      console.log('[AttendanceService] Security checks passed, proceeding with update');
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
              this.httpService.get(`http://giurom.bitap.ro:3002/employees/${shift.employee_id}`)
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
            
            console.log(`[AttendanceService] Notificare trimisă angajatului ${employeeUserId} (employee_id: ${shift.employee_id}) pentru finalizarea programului`);
          }
        }
      } catch (error) {
        console.error('[AttendanceService] Eroare la trimiterea notificării:', error);
        // Nu aruncăm eroarea - notificarea este opțională
      }
    }

    return savedPresence;
  }

  async deletePresence(id: number): Promise<void> {
    const presence = await this.presenceRepository.findOne({
      where: { id },
      relations: ['inflexions', 'shift'],
    });

    if (!presence) {
      throw new NotFoundException(`Prezența cu ID-ul ${id} nu a fost găsită`);
    }

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

    // Verifică dacă prezența există
    const presence = await this.presenceRepository.findOne({ where: { id: presence_id } });
    if (!presence) {
      throw new NotFoundException(`Prezența cu ID-ul ${presence_id} nu a fost găsită`);
    }

    const inflexion = this.presenceInflexionRepository.create({
      ...rest,
      presence_id,
      timestamp: new Date(timestamp),
    });

    return await this.presenceInflexionRepository.save(inflexion);
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

  async findPresenceInflexionById(id: number): Promise<PresenceInflexion> {
    const inflexion = await this.presenceInflexionRepository.findOne({
      where: { id },
      relations: ['presence', 'presence.shift'],
    });

    if (!inflexion) {
      throw new NotFoundException(`Punctul de inflexiune cu ID-ul ${id} nu a fost găsit`);
    }

    return inflexion;
  }

  async updatePresenceInflexion(
    id: number, 
    updateInflexionDto: UpdatePresenceInflexionDto,
  ): Promise<PresenceInflexion> {
    const inflexion = await this.findPresenceInflexionById(id);

    Object.assign(inflexion, updateInflexionDto);
    return await this.presenceInflexionRepository.save(inflexion);
  }

  async deletePresenceInflexion(id: number): Promise<void> {
    const inflexion = await this.findPresenceInflexionById(id);
    await this.presenceInflexionRepository.remove(inflexion);
  }

  // ACTIVE SHIFT CHECK
  async getActiveShiftForEmployee(employeeId: number): Promise<{
    hasActiveShift: boolean;
    shift: Shift | null;
    presence: Presence | null;
  }> {
    // Caută prezența activă direct (check_in setat, check_out nesetat),
    // indiferent de ziua în care a început shift-ul.
    // Astfel acoperim corect și turele ce trec peste miezul nopții.
    const activePresence = await this.presenceRepository
      .createQueryBuilder('presence')
      .innerJoinAndSelect('presence.shift', 'shift')
      .where('shift.employee_id = :employeeId', { employeeId })
      .andWhere('presence.check_in IS NOT NULL')
      .andWhere('presence.check_out IS NULL')
      .orderBy('presence.check_in', 'DESC')
      .getOne();

    if (!activePresence) {
      return { hasActiveShift: false, shift: null, presence: null };
    }

    return {
      hasActiveShift: true,
      shift: activePresence.shift || null,
      presence: activePresence,
    };
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

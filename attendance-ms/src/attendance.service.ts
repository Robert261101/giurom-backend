import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, Not } from 'typeorm';
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
import { toZonedTime } from 'date-fns-tz';

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
    metadata?: any
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'attendance.notification' }, {
          type,
          title,
          description,
          user_id: userId,
          entity_type: 'attendance',
          metadata,
          priority: 'medium',
        })
      );
    } catch (error) {
      console.error('Failed to send attendance notification:', error);
    }
  }

  private async addEmployeePoints(employeeId: number, points: number, reason: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post('http://giurom.bitap.ro:3002/tasks/executions/daily-points', {
          employee_id: employeeId,
          total_points: points,
          work_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
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
    target_url?: string  // Add target_url parameter
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'shift.notification' }, {
          type,
          title,
          description,
          user_id: userId,
          entity_id: shiftId,
          entity_type: 'shift',
          metadata,
          priority: 'medium',
          target_url,  // Add target_url to notification data
        })
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
    
    // Send notification to admin and the employee for whom the shift was created
    await this.sendShiftNotification(
      'shift_created',
      'Schimb programat',
      `A fost creat un nou schimb programat pentru data de ${startDate.toLocaleDateString('ro-RO')} - ${endDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`,
      employee_id,
      savedShift.id,
      {
        shiftId: savedShift.id,
        employeeId: employee_id,
        startDate: startDate,
        endDate: endDate,
      },
      `/pontaj`  // Add target_url
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
    return await this.shiftRepository.save(shift);
  }

  async deleteShift(id: number): Promise<void> {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['presences'],
    });

    if (!shift) {
      throw new NotFoundException(`Schimbul cu ID-ul ${id} nu a fost găsit`);
    }

    // Delete all associated presences and their inflexions
    for (const presence of shift.presences) {
      // Delete all inflexions for this presence
      await this.presenceInflexionRepository.delete({ presence_id: presence.id } as any);
      // Delete the presence
      await this.presenceRepository.remove(presence);
    }

    // Delete the shift
    await this.shiftRepository.remove(shift);

    // Send notification that shift was deleted
    await this.sendShiftNotification(
      'shift_deleted',
      'Schimb sters',
      `Schimbul pentru data de ${shift.start_datetime.toLocaleDateString('ro-RO')} a fost sters`,
      shift.employee_id,
      shift.id,
      {
        shiftId: shift.id,
        employeeId: shift.employee_id,
        startDate: shift.start_datetime,
        endDate: shift.end_datetime,
      },
      `/pontaj`  // Add target_url
    );
  }

  // PRESENCE METHODS
  async createPresence(createPresenceDto: CreatePresenceDto): Promise<Presence> {
    const { shift_id, date, check_in, check_out, ...rest } = createPresenceDto;

    // Verifică dacă schimbul există
    const shift = await this.shiftRepository.findOne({ where: { id: shift_id } });
    if (!shift) {
      throw new NotFoundException(`Schimbul cu ID-ul ${shift_id} nu a fost găsit`);
    }

    // Verifică dacă nu există deja o prezență pentru această dată și schimb
    const existingPresence = await this.presenceRepository.findOne({
      where: { shift_id, date: new Date(date) },
    });

    if (existingPresence) {
      throw new ConflictException('Există deja o prezență înregistrată pentru această dată și schimb');
    }

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

    const presence = this.presenceRepository.create({
      ...rest,
      shift_id,
      date: new Date(date),
      check_in: check_in ? toZonedTime(new Date(check_in), 'Europe/Bucharest') : null,
      check_out: check_out ? toZonedTime(new Date(check_out), 'Europe/Bucharest') : null,
      auto_checkout: autoCheckout,
    });

    const savedPresence = await this.presenceRepository.save(presence);
    
    // Logica pentru puncte - doar dacă există check_in
    if (check_in) {
      const checkInTime = savedPresence.check_in ? new Date(savedPresence.check_in) : new Date(check_in);
      const shiftStartTime = new Date(shift.start_datetime);

      // Extrag doar ora din shift (ignorăm data pentru pontajul curent)
      const shiftStartHour = shiftStartTime.getHours();
      const shiftStartMinute = shiftStartTime.getMinutes();

      // Folosim data din check_in (nu date) pentru a calcula ora de început a shift-ului
      // Astfel funcționează corect și când check_in este după miezul nopții
      const checkInDate = new Date(check_in);
      const checkInDay = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
      const todayShiftStart = new Date(checkInDay);
      todayShiftStart.setHours(shiftStartHour, shiftStartMinute, 0, 0);

      // Pragul minim: cel puțin o oră înainte de începutul programului
      const minimumLeadTimeMs = 60 * 60 * 1000; // 60 minute
      const diffMs = todayShiftStart.getTime() - checkInTime.getTime();

      console.log(`🕐 Check-in time: ${checkInTime.toISOString()}`);
      console.log(`🕐 Shift start time (pontaj): ${todayShiftStart.toISOString()}`);
      console.log(`🕐 Diferență (ms) față de start: ${diffMs}`);
      console.log(`🕐 Prag necesar (ms): ${minimumLeadTimeMs}`);

      if (diffMs >= minimumLeadTimeMs) {
        await this.addEmployeePoints(
          shift.employee_id, 
          5, 
          `Punctualitate - început program cu cel puțin o oră înainte (${checkInTime.toLocaleTimeString('ro-RO')})`
        );
      } else {
        console.log(`⏰ Check-in pentru angajat ${shift.employee_id} nu respectă pragul de 1 oră înainte - nu se acordă puncte`);
      }
    }
    
    // Send notification to admin and the employee for whom the attendance was created
    await this.sendAttendanceNotification(
      'attendance_created',
      'Pontaj creat',
      `A fost creat un nou pontaj pentru data de ${new Date(date).toLocaleDateString('ro-RO')}`,
      shift.employee_id,
      {
        presenceId: savedPresence.id,
        shiftId: shift_id,
        date: date,
        employeeId: shift.employee_id,
      }
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
              }
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

    // Send notification that presence was deleted
    await this.sendAttendanceNotification(
      'presence_deleted',
      'Prezenta stearsa',
      `Prezența pentru data de ${presence.date.toLocaleDateString('ro-RO')} a fost ștearsă`,
      presence.shift.employee_id,
      {
        presenceId: presence.id,
        employeeId: presence.shift.employee_id,
        date: presence.date,
      }
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

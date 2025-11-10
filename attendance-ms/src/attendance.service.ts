import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, Not } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { Presence, PresenceStatus } from './entities/presence.entity';
import { PresenceInflexion, InflexionType } from './entities/presence-inflexion.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreatePresenceDto } from './dto/create-presence.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { CreatePresenceInflexionDto } from './dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from './dto/update-presence-inflexion.dto';

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
    metadata?: any
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
    const startDate = new Date(start_datetime);
    const endDate = new Date(end_datetime);

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
      }
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
        ? new Date(updateShiftDto.start_datetime) 
        : shift.start_datetime;
      const endDate = updateShiftDto.end_datetime 
        ? new Date(updateShiftDto.end_datetime) 
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
      }
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

    const presence = this.presenceRepository.create({
      ...rest,
      shift_id,
      date: new Date(date),
      check_in: check_in ? new Date(check_in) : null,
      check_out: check_out ? new Date(check_out) : null,
    });

    const savedPresence = await this.presenceRepository.save(presence);
    
    // Logica pentru puncte - doar dacă există check_in
    if (check_in) {
      const checkInTime = new Date(check_in);
      const shiftStartTime = new Date(shift.start_datetime);

      // Extrag doar ora din shift (ignorăm data pentru pontajul curent)
      const shiftStartHour = shiftStartTime.getHours();
      const shiftStartMinute = shiftStartTime.getMinutes();

      // Creez ora de început pentru ziua curentă (din pontaj)
      const presenceDate = new Date(date);
      const todayShiftStart = new Date(presenceDate);
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
  ): Promise<{ data: Presence[]; total: number; page: number; limit: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const shiftIdNum = shift_id ? parseInt(shift_id, 10) : undefined;
    
    const where: any = {};
    if (shiftIdNum) where.shift_id = shiftIdNum;
    if (status) where.status = status;
    
    console.log('🔍 [findAllPresences] Parametrii primiti:', { page, limit, shift_id, status, start_date, end_date });
    console.log('🔍 [findAllPresences] Parametrii convertiti:', { pageNum, limitNum, shiftIdNum, status, start_date, end_date });

    if (start_date && end_date) {
      if (start_date === end_date) {
        // Când start_date și end_date sunt egale, filtrează doar pentru acea dată
        const targetDate = new Date(start_date);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
        where.date = Between(startOfDay, endOfDay);
      } else {
        where.date = Between(new Date(start_date), new Date(end_date));
      }
    } else if (start_date) {
      where.date = MoreThanOrEqual(new Date(start_date));
    } else if (end_date) {
      where.date = LessThanOrEqual(new Date(end_date));
    }

    console.log('🔍 [findAllPresences] Where clause:', where);
    
    const [data, total] = await this.presenceRepository.findAndCount({
      where,
      relations: ['shift', 'inflexions'],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { date: 'DESC' },
    });

    console.log('🔍 [findAllPresences] Rezultat query:', { dataCount: data.length, total });
    
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

  async updatePresence(id: number, updatePresenceDto: UpdatePresenceDto): Promise<Presence> {
    const presence = await this.findPresenceById(id);

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

      // Recalculează orele lucrate dacă ambele sunt setate
      if (checkInDate && checkOutDate && !updatePresenceDto.total_hours) {
        const diffMs = checkOutDate.getTime() - checkInDate.getTime();
        updatePresenceDto.total_hours = diffMs / (1000 * 60 * 60);
      }
    }

    Object.assign(presence, updatePresenceDto);
    return await this.presenceRepository.save(presence);
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

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
export class AttendanceService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Presence)
    private readonly presenceRepository: Repository<Presence>,
    @InjectRepository(PresenceInflexion)
    private readonly presenceInflexionRepository: Repository<PresenceInflexion>,
  ) {}

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
      employee_id,
      start_datetime: startDate,
      end_datetime: endDate,
    });

    return await this.shiftRepository.save(shift);
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
      relations: ['employee', 'presences'],
      skip: (page - 1) * limit,
      take: limit,
      order: { start_datetime: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findShiftById(id: number): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['employee', 'presences'],
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
    const shift = await this.findShiftById(id);
    await this.shiftRepository.remove(shift);
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

    return await this.presenceRepository.save(presence);
  }

  async findAllPresences(
    page: number = 1,
    limit: number = 10,
    shift_id?: number,
    status?: PresenceStatus,
    start_date?: string,
    end_date?: string,
  ): Promise<{ data: Presence[]; total: number; page: number; limit: number }> {
    const where: any = {};
    if (shift_id) where.shift_id = shift_id;
    if (status) where.status = status;

    if (start_date && end_date) {
      where.date = Between(new Date(start_date), new Date(end_date));
    } else if (start_date) {
      where.date = MoreThanOrEqual(new Date(start_date));
    } else if (end_date) {
      where.date = LessThanOrEqual(new Date(end_date));
    }

    const [data, total] = await this.presenceRepository.findAndCount({
      where,
      relations: ['shift', 'shift.employee', 'inflexions'],
      skip: (page - 1) * limit,
      take: limit,
      order: { date: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findPresenceById(id: number): Promise<Presence> {
    const presence = await this.presenceRepository.findOne({
      where: { id },
      relations: ['shift', 'shift.employee', 'inflexions'],
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
    const presence = await this.findPresenceById(id);
    await this.presenceRepository.remove(presence);
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
      relations: ['presence', 'presence.shift', 'presence.shift.employee'],
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findPresenceInflexionById(id: number): Promise<PresenceInflexion> {
    const inflexion = await this.presenceInflexionRepository.findOne({
      where: { id },
      relations: ['presence', 'presence.shift', 'presence.shift.employee'],
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
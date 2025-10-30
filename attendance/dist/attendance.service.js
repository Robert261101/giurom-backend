"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
const typeorm_2 = require("typeorm");
const shift_entity_1 = require("./entities/shift.entity");
const presence_entity_1 = require("./entities/presence.entity");
const presence_inflexion_entity_1 = require("./entities/presence-inflexion.entity");
let AttendanceService = class AttendanceService {
    constructor(shiftRepository, presenceRepository, presenceInflexionRepository, notificationsClient) {
        this.shiftRepository = shiftRepository;
        this.presenceRepository = presenceRepository;
        this.presenceInflexionRepository = presenceInflexionRepository;
        this.notificationsClient = notificationsClient;
    }
    async onModuleInit() {
        try {
            await this.shiftRepository.query("ALTER TABLE `shifts` MODIFY `position_id` INT NULL DEFAULT NULL");
        }
        catch (_e) {
        }
    }
    async sendAttendanceNotification(type, title, description, userId, metadata) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: 'attendance.notification' }, {
                type,
                title,
                description,
                user_id: userId,
                entity_type: 'attendance',
                metadata,
                priority: 'medium',
            }));
        }
        catch (error) {
            console.error('Failed to send attendance notification:', error);
        }
    }
    async sendShiftNotification(type, title, description, userId, shiftId, metadata) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: 'shift.notification' }, {
                type,
                title,
                description,
                user_id: userId,
                entity_id: shiftId,
                entity_type: 'shift',
                metadata,
                priority: 'medium',
            }));
        }
        catch (error) {
            console.error('Failed to send shift notification:', error);
        }
    }
    async createShift(createShiftDto) {
        const { start_datetime, end_datetime, employee_id, ...rest } = createShiftDto;
        const startDate = new Date(start_datetime);
        const endDate = new Date(end_datetime);
        if (startDate >= endDate) {
            throw new common_1.BadRequestException('Data de început trebuie să fie înainte de data de sfârșit');
        }
        const overlappingShift = await this.shiftRepository.findOne({
            where: [
                {
                    employee_id,
                    start_datetime: (0, typeorm_2.LessThanOrEqual)(endDate),
                    end_datetime: (0, typeorm_2.MoreThanOrEqual)(startDate),
                },
            ],
        });
        if (overlappingShift) {
            throw new common_1.ConflictException('Există deja un schimb programat pentru acest angajat în intervalul specificat');
        }
        const shift = this.shiftRepository.create({
            ...rest,
            position_id: rest.position_id ?? null,
            employee_id,
            start_datetime: startDate,
            end_datetime: endDate,
        });
        const savedShift = await this.shiftRepository.save(shift);
        await this.sendShiftNotification('shift_created', 'Schimb programat', `A fost creat un nou schimb programat pentru data de ${startDate.toLocaleDateString('ro-RO')} - ${endDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`, employee_id, savedShift.id, {
            shiftId: savedShift.id,
            employeeId: employee_id,
            startDate: startDate,
            endDate: endDate,
        });
        return savedShift;
    }
    async findAllShifts(page = 1, limit = 10, employee_id, work_location_id, department_id) {
        const where = {};
        if (employee_id)
            where.employee_id = employee_id;
        if (work_location_id)
            where.work_location_id = work_location_id;
        if (department_id)
            where.department_id = department_id;
        const [data, total] = await this.shiftRepository.findAndCount({
            where,
            relations: ['presences'],
            skip: (page - 1) * limit,
            take: limit,
            order: { start_datetime: 'DESC' },
        });
        return { data, total, page, limit };
    }
    async findShiftById(id) {
        const shift = await this.shiftRepository.findOne({
            where: { id },
            relations: ['presences'],
        });
        if (!shift) {
            throw new common_1.NotFoundException(`Schimbul cu ID-ul ${id} nu a fost găsit`);
        }
        return shift;
    }
    async updateShift(id, updateShiftDto) {
        const shift = await this.findShiftById(id);
        if (updateShiftDto.start_datetime || updateShiftDto.end_datetime) {
            const startDate = updateShiftDto.start_datetime
                ? new Date(updateShiftDto.start_datetime)
                : shift.start_datetime;
            const endDate = updateShiftDto.end_datetime
                ? new Date(updateShiftDto.end_datetime)
                : shift.end_datetime;
            if (startDate >= endDate) {
                throw new common_1.BadRequestException('Data de început trebuie să fie înainte de data de sfârșit');
            }
            const overlappingShift = await this.shiftRepository.findOne({
                where: [
                    {
                        id: (0, typeorm_2.Not)(id),
                        employee_id: shift.employee_id,
                        start_datetime: (0, typeorm_2.LessThanOrEqual)(endDate),
                        end_datetime: (0, typeorm_2.MoreThanOrEqual)(startDate),
                    },
                ],
            });
            if (overlappingShift) {
                throw new common_1.ConflictException('Există deja un schimb programat pentru acest angajat în intervalul specificat');
            }
        }
        Object.assign(shift, updateShiftDto);
        return await this.shiftRepository.save(shift);
    }
    async deleteShift(id) {
        const shift = await this.shiftRepository.findOne({
            where: { id },
            relations: ['presences'],
        });
        if (!shift) {
            throw new common_1.NotFoundException(`Schimbul cu ID-ul ${id} nu a fost găsit`);
        }
        for (const presence of shift.presences) {
            await this.presenceInflexionRepository.delete({ presence_id: presence.id });
            await this.presenceRepository.remove(presence);
        }
        await this.shiftRepository.remove(shift);
        await this.sendShiftNotification('shift_deleted', 'Schimb șters', `Schimbul pentru data de ${shift.start_datetime.toLocaleDateString('ro-RO')} a fost șters`, shift.employee_id, shift.id, {
            shiftId: shift.id,
            employeeId: shift.employee_id,
            startDate: shift.start_datetime,
            endDate: shift.end_datetime,
        });
    }
    async createPresence(createPresenceDto) {
        const { shift_id, date, check_in, check_out, ...rest } = createPresenceDto;
        const shift = await this.shiftRepository.findOne({ where: { id: shift_id } });
        if (!shift) {
            throw new common_1.NotFoundException(`Schimbul cu ID-ul ${shift_id} nu a fost găsit`);
        }
        const existingPresence = await this.presenceRepository.findOne({
            where: { shift_id, date: new Date(date) },
        });
        if (existingPresence) {
            throw new common_1.ConflictException('Există deja o prezență înregistrată pentru această dată și schimb');
        }
        if (check_in && check_out) {
            const checkInDate = new Date(check_in);
            const checkOutDate = new Date(check_out);
            if (checkInDate >= checkOutDate) {
                throw new common_1.BadRequestException('Check-in trebuie să fie înainte de check-out');
            }
            if (!rest.total_hours) {
                const diffMs = checkOutDate.getTime() - checkInDate.getTime();
                rest.total_hours = diffMs / (1000 * 60 * 60);
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
        await this.sendAttendanceNotification('attendance_created', 'Pontaj creat', `A fost creat un nou pontaj pentru data de ${new Date(date).toLocaleDateString('ro-RO')}`, shift.employee_id, {
            presenceId: savedPresence.id,
            shiftId: shift_id,
            date: date,
            employeeId: shift.employee_id,
        });
        return savedPresence;
    }
    async findAllPresences(page = 1, limit = 10, shift_id, status, start_date, end_date) {
        const where = {};
        if (shift_id)
            where.shift_id = shift_id;
        if (status)
            where.status = status;
        if (start_date && end_date) {
            where.date = (0, typeorm_2.Between)(new Date(start_date), new Date(end_date));
        }
        else if (start_date) {
            where.date = (0, typeorm_2.MoreThanOrEqual)(new Date(start_date));
        }
        else if (end_date) {
            where.date = (0, typeorm_2.LessThanOrEqual)(new Date(end_date));
        }
        const [data, total] = await this.presenceRepository.findAndCount({
            where,
            relations: ['shift', 'inflexions'],
            skip: (page - 1) * limit,
            take: limit,
            order: { date: 'DESC' },
        });
        return { data, total, page, limit };
    }
    async findPresenceById(id) {
        const presence = await this.presenceRepository.findOne({
            where: { id },
            relations: ['shift', 'inflexions'],
        });
        if (!presence) {
            throw new common_1.NotFoundException(`Prezența cu ID-ul ${id} nu a fost găsită`);
        }
        return presence;
    }
    async updatePresence(id, updatePresenceDto) {
        const presence = await this.findPresenceById(id);
        if (updatePresenceDto.check_in || updatePresenceDto.check_out) {
            const checkInDate = updatePresenceDto.check_in
                ? new Date(updatePresenceDto.check_in)
                : presence.check_in;
            const checkOutDate = updatePresenceDto.check_out
                ? new Date(updatePresenceDto.check_out)
                : presence.check_out;
            if (checkInDate && checkOutDate && checkInDate >= checkOutDate) {
                throw new common_1.BadRequestException('Check-in trebuie să fie înainte de check-out');
            }
            if (checkInDate && checkOutDate && !updatePresenceDto.total_hours) {
                const diffMs = checkOutDate.getTime() - checkInDate.getTime();
                updatePresenceDto.total_hours = diffMs / (1000 * 60 * 60);
            }
        }
        Object.assign(presence, updatePresenceDto);
        return await this.presenceRepository.save(presence);
    }
    async deletePresence(id) {
        const presence = await this.presenceRepository.findOne({
            where: { id },
            relations: ['inflexions', 'shift'],
        });
        if (!presence) {
            throw new common_1.NotFoundException(`Prezența cu ID-ul ${id} nu a fost găsită`);
        }
        for (const inflexion of presence.inflexions) {
            await this.presenceInflexionRepository.remove(inflexion);
        }
        await this.presenceRepository.remove(presence);
        await this.sendAttendanceNotification('presence_deleted', 'Prezență ștearsă', `Prezența pentru data de ${presence.date.toLocaleDateString('ro-RO')} a fost ștearsă`, presence.shift.employee_id, {
            presenceId: presence.id,
            employeeId: presence.shift.employee_id,
            date: presence.date,
        });
    }
    async createPresenceInflexion(createInflexionDto) {
        const { presence_id, timestamp, ...rest } = createInflexionDto;
        const presence = await this.presenceRepository.findOne({ where: { id: presence_id } });
        if (!presence) {
            throw new common_1.NotFoundException(`Prezența cu ID-ul ${presence_id} nu a fost găsită`);
        }
        const inflexion = this.presenceInflexionRepository.create({
            ...rest,
            presence_id,
            timestamp: new Date(timestamp),
        });
        return await this.presenceInflexionRepository.save(inflexion);
    }
    async findAllPresenceInflexions(page = 1, limit = 10, presence_id, type) {
        const where = {};
        if (presence_id)
            where.presence_id = presence_id;
        if (type)
            where.type = type;
        const [data, total] = await this.presenceInflexionRepository.findAndCount({
            where,
            relations: ['presence', 'presence.shift'],
            skip: (page - 1) * limit,
            take: limit,
            order: { timestamp: 'DESC' },
        });
        return { data, total, page, limit };
    }
    async findPresenceInflexionById(id) {
        const inflexion = await this.presenceInflexionRepository.findOne({
            where: { id },
            relations: ['presence', 'presence.shift'],
        });
        if (!inflexion) {
            throw new common_1.NotFoundException(`Punctul de inflexiune cu ID-ul ${id} nu a fost găsit`);
        }
        return inflexion;
    }
    async updatePresenceInflexion(id, updateInflexionDto) {
        const inflexion = await this.findPresenceInflexionById(id);
        Object.assign(inflexion, updateInflexionDto);
        return await this.presenceInflexionRepository.save(inflexion);
    }
    async deletePresenceInflexion(id) {
        const inflexion = await this.findPresenceInflexionById(id);
        await this.presenceInflexionRepository.remove(inflexion);
    }
    async getAttendanceStatistics(employee_id, start_date, end_date) {
        const where = {};
        if (employee_id)
            where.shift_id = employee_id;
        if (start_date && end_date) {
            where.date = (0, typeorm_2.Between)(new Date(start_date), new Date(end_date));
        }
        const [totalPresences, presentFull, presentPartial, absent] = await Promise.all([
            this.presenceRepository.count({ where }),
            this.presenceRepository.count({ where: { ...where, status: presence_entity_1.PresenceStatus.PRESENT_FULL } }),
            this.presenceRepository.count({ where: { ...where, status: presence_entity_1.PresenceStatus.PRESENT_PARTIAL } }),
            this.presenceRepository.count({ where: { ...where, status: presence_entity_1.PresenceStatus.ABSENT } }),
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
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(shift_entity_1.Shift)),
    __param(1, (0, typeorm_1.InjectRepository)(presence_entity_1.Presence)),
    __param(2, (0, typeorm_1.InjectRepository)(presence_inflexion_entity_1.PresenceInflexion)),
    __param(3, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        microservices_1.ClientProxy])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map
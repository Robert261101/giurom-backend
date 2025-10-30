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
exports.CalendarService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const calendar_event_entity_1 = require("./entities/calendar-event.entity");
const recurrence_rule_entity_1 = require("./entities/recurrence-rule.entity");
const employee_entity_1 = require("../employee/entity/employee.entity");
let CalendarService = class CalendarService {
    constructor(eventRepo, recurrenceRepo, employeeRepo) {
        this.eventRepo = eventRepo;
        this.recurrenceRepo = recurrenceRepo;
        this.employeeRepo = employeeRepo;
    }
    async createRecurrenceRule(dto) {
        const startDate = new Date(dto.start_datetime);
        const endDate = dto.end_datetime ? new Date(dto.end_datetime) : null;
        if (endDate && endDate <= startDate) {
            throw new common_1.BadRequestException('Data de sfârșit trebuie să fie după data de început');
        }
        if (dto.frequency === recurrence_rule_entity_1.RecurrenceFrequency.WEEKLY && !dto.recurrence_days) {
            throw new common_1.BadRequestException('Pentru frecvența săptămânală, zilele recurenței sunt obligatorii');
        }
        const recurrenceRule = this.recurrenceRepo.create({
            ...dto,
            start_datetime: startDate,
            end_datetime: endDate || undefined,
        });
        return this.recurrenceRepo.save(recurrenceRule);
    }
    async createEvent(dto, currentUserId) {
        if (currentUserId && currentUserId !== dto.created_by) {
            throw new common_1.ForbiddenException('Nu poți crea evenimente pentru alți utilizatori');
        }
        const startDate = new Date(dto.start_datetime);
        const endDate = new Date(dto.end_datetime);
        if (endDate <= startDate) {
            throw new common_1.BadRequestException('Data de sfârșit trebuie să fie după data de început');
        }
        const calculatedDuration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
        if (Math.abs(dto.duration - calculatedDuration) > 1) {
            throw new common_1.BadRequestException('Durata specificată nu corespunde cu diferența dintre start și end');
        }
        if (dto.recurrence_id) {
            const recurrenceRule = await this.recurrenceRepo.findOne({ where: { id: dto.recurrence_id } });
            if (!recurrenceRule) {
                throw new common_1.NotFoundException('Regula de recurență nu a fost găsită');
            }
        }
        const event = this.eventRepo.create({
            ...dto,
            start_datetime: startDate,
            end_datetime: endDate,
        });
        return this.eventRepo.save(event);
    }
    async findEvents(filters, currentUserId) {
        const queryBuilder = this.eventRepo.createQueryBuilder('event')
            .leftJoinAndSelect('event.recurrence_rule', 'recurrence');
        if (filters.start_date && filters.end_date) {
            queryBuilder.andWhere('event.start_datetime BETWEEN :startDate AND :endDate', {
                startDate: new Date(filters.start_date),
                endDate: new Date(filters.end_date),
            });
        }
        else if (filters.start_date) {
            queryBuilder.andWhere('event.start_datetime >= :startDate', { startDate: new Date(filters.start_date) });
        }
        else if (filters.end_date) {
            queryBuilder.andWhere('event.start_datetime <= :endDate', { endDate: new Date(filters.end_date) });
        }
        if (filters.category) {
            queryBuilder.andWhere('event.category = :category', { category: filters.category });
        }
        if (filters.created_by) {
            queryBuilder.andWhere('event.created_by = :createdBy', { createdBy: filters.created_by });
        }
        if (filters.search) {
            queryBuilder.andWhere('(event.title LIKE :search OR event.description LIKE :search)', { search: `%${filters.search}%` });
        }
        if (currentUserId) {
            queryBuilder.andWhere('event.created_by = :currentUserId', { currentUserId });
        }
        queryBuilder.orderBy('event.start_datetime', 'ASC');
        return queryBuilder.getMany();
    }
    async findOne(id, currentUserId) {
        const event = await this.eventRepo.findOne({ where: { id }, relations: ['recurrence_rule'] });
        if (!event) {
            throw new common_1.NotFoundException('Evenimentul nu a fost găsit');
        }
        if (currentUserId && event.created_by !== currentUserId && currentUserId !== 2) {
            throw new common_1.ForbiddenException('Nu ai permisiunea să vezi acest eveniment');
        }
        return event;
    }
    async updateEvent(id, dto, currentUserId) {
        const event = await this.findOne(id, currentUserId);
        if (currentUserId && event.created_by !== currentUserId && currentUserId !== 2) {
            throw new common_1.ForbiddenException('Nu ai permisiunea să modifici acest eveniment');
        }
        if (dto.start_datetime || dto.end_datetime) {
            const startDate = dto.start_datetime ? new Date(dto.start_datetime) : event.start_datetime;
            const endDate = dto.end_datetime ? new Date(dto.end_datetime) : event.end_datetime;
            if (endDate <= startDate) {
                throw new common_1.BadRequestException('Data de sfârșit trebuie să fie după data de început');
            }
            const calculatedDuration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
            if (dto.start_datetime || dto.end_datetime) {
                dto.duration = calculatedDuration;
            }
        }
        if (dto.recurrence_id) {
            const recurrenceRule = await this.recurrenceRepo.findOne({ where: { id: dto.recurrence_id } });
            if (!recurrenceRule) {
                throw new common_1.NotFoundException('Regula de recurență nu a fost găsită');
            }
        }
        Object.assign(event, {
            ...dto,
            start_datetime: dto.start_datetime ? new Date(dto.start_datetime) : event.start_datetime,
            end_datetime: dto.end_datetime ? new Date(dto.end_datetime) : event.end_datetime,
        });
        return this.eventRepo.save(event);
    }
    async removeEvent(id, currentUserId) {
        const event = await this.findOne(id, currentUserId);
        if (currentUserId && event.created_by !== currentUserId && currentUserId !== 2) {
            throw new common_1.ForbiddenException('Nu ai permisiunea să ștergi acest eveniment');
        }
        await this.eventRepo.remove(event);
        return { success: true };
    }
    async findAllRecurrenceRules() {
        return this.recurrenceRepo.find({ relations: ['events'], order: { id: 'DESC' } });
    }
    async findRecurrenceRule(id) {
        const rule = await this.recurrenceRepo.findOne({ where: { id }, relations: ['events'] });
        if (!rule) {
            throw new common_1.NotFoundException('Regula de recurență nu a fost găsită');
        }
        return rule;
    }
    async generateRecurringEvents(recurrenceRuleId, startDate, endDate) {
        const rule = await this.findRecurrenceRule(recurrenceRuleId);
        const events = [];
        let currentDate = new Date(Math.max(rule.start_datetime.getTime(), startDate.getTime()));
        const ruleEndDate = rule.end_datetime || endDate;
        while (currentDate <= ruleEndDate && currentDate <= endDate) {
            if (this.matchesRecurrenceRule(currentDate, rule)) {
                events.push({
                    title: `Eveniment recurent (${rule.frequency})`,
                    start_datetime: new Date(currentDate),
                });
            }
            currentDate = this.getNextRecurrenceDate(currentDate, rule);
        }
        return events;
    }
    async updateRecurrenceEndDate(eventId, endDateIso, currentUserId) {
        const event = await this.findOne(eventId, currentUserId);
        if (event.recurrence_id) {
            const rule = await this.recurrenceRepo.findOne({ where: { id: event.recurrence_id } });
            if (!rule)
                throw new common_1.NotFoundException('Regula de recurență nu a fost găsită');
            const endDate = new Date(endDateIso);
            if (isNaN(endDate.getTime()))
                throw new common_1.BadRequestException('Data de sfârșit recurență invalidă');
            if (rule.start_datetime && endDate <= rule.start_datetime) {
                throw new common_1.BadRequestException('Data de sfârșit recurență trebuie să fie după data de început');
            }
            rule.end_datetime = endDate;
            await this.recurrenceRepo.save(rule);
            return { success: true };
        }
        throw new common_1.BadRequestException('Evenimentul nu are recurență asociată');
    }
    matchesRecurrenceRule(date, rule) {
        if (rule.frequency === recurrence_rule_entity_1.RecurrenceFrequency.WEEKLY && rule.recurrence_days) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDay = dayNames[date.getDay()];
            return rule.recurrence_days.split(',').includes(currentDay);
        }
        return true;
    }
    getNextRecurrenceDate(currentDate, rule) {
        const nextDate = new Date(currentDate);
        switch (rule.frequency) {
            case recurrence_rule_entity_1.RecurrenceFrequency.DAILY:
                nextDate.setDate(nextDate.getDate() + rule.interval);
                break;
            case recurrence_rule_entity_1.RecurrenceFrequency.WEEKLY:
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case recurrence_rule_entity_1.RecurrenceFrequency.MONTHLY:
                nextDate.setMonth(nextDate.getMonth() + rule.interval);
                break;
            default:
                nextDate.setDate(nextDate.getDate() + 1);
        }
        return nextDate;
    }
};
exports.CalendarService = CalendarService;
exports.CalendarService = CalendarService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(calendar_event_entity_1.CalendarEvent)),
    __param(1, (0, typeorm_1.InjectRepository)(recurrence_rule_entity_1.RecurrenceRule)),
    __param(2, (0, typeorm_1.InjectRepository)(employee_entity_1.Employee)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CalendarService);
//# sourceMappingURL=calendar.service.js.map
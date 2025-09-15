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
var ShiftChangeRequestsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftChangeRequestsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const typeorm_2 = require("typeorm");
const shift_change_request_entity_1 = require("./entities/shift-change-request.entity");
let ShiftChangeRequestsService = ShiftChangeRequestsService_1 = class ShiftChangeRequestsService {
    constructor(shiftChangeRepo, httpService) {
        this.shiftChangeRepo = shiftChangeRepo;
        this.httpService = httpService;
        this.logger = new common_1.Logger(ShiftChangeRequestsService_1.name);
    }
    async create(dto, currentUserId) {
        this.logger.log(`Creating shift change request from employee ${dto.employee_id} to ${dto.replacement_id}`);
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService.get(`http://localhost:3012/employees/${dto.employee_id}`));
        }
        catch (error) {
            this.logger.error(`Employee with ID ${dto.employee_id} not found: ${error.message}`);
            throw new common_1.NotFoundException('Angajatul care cere schimbul nu a fost găsit');
        }
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService.get(`http://localhost:3012/employees/${dto.replacement_id}`));
        }
        catch (error) {
            this.logger.error(`Replacement employee with ID ${dto.replacement_id} not found: ${error.message}`);
            throw new common_1.NotFoundException('Angajatul înlocuitor nu a fost găsit');
        }
        if (currentUserId && currentUserId !== dto.employee_id) {
            this.logger.warn(`User ${currentUserId} attempted to create shift change request for employee ${dto.employee_id}`);
            throw new common_1.ForbiddenException('Nu poți crea cereri de schimb de tură pentru alți angajați');
        }
        const startDate = new Date(dto.start_datetime);
        const endDate = new Date(dto.end_datetime);
        const now = new Date();
        if (endDate <= startDate) {
            this.logger.error(`Invalid date range: start ${startDate}, end ${endDate}`);
            throw new common_1.BadRequestException('Data de sfârșit trebuie să fie după data de început');
        }
        if (startDate < now) {
            this.logger.error(`Start date ${startDate} is in the past`);
            throw new common_1.BadRequestException('Data de început nu poate fi în trecut');
        }
        if (dto.employee_id === dto.replacement_id) {
            this.logger.error(`Employee ${dto.employee_id} attempted to replace themselves`);
            throw new common_1.BadRequestException('Nu te poți înlocui pe tine însuți');
        }
        const overlappingRequests = await this.shiftChangeRepo
            .createQueryBuilder('scr')
            .where('(scr.employee_id = :employeeId OR scr.replacement_id = :employeeId)', { employeeId: dto.employee_id })
            .andWhere('scr.status = :status', { status: shift_change_request_entity_1.ShiftChangeStatus.APPROVED })
            .andWhere('(scr.start_datetime <= :endDate AND scr.end_datetime >= :startDate)', { startDate, endDate })
            .getCount();
        if (overlappingRequests > 0) {
            this.logger.error(`Overlapping shift change requests found for employee ${dto.employee_id}`);
            throw new common_1.BadRequestException('Există deja o cerere de schimb aprobată în această perioadă');
        }
        const replacementOverlapping = await this.shiftChangeRepo
            .createQueryBuilder('scr')
            .where('(scr.employee_id = :replacementId OR scr.replacement_id = :replacementId)', { replacementId: dto.replacement_id })
            .andWhere('scr.status = :status', { status: shift_change_request_entity_1.ShiftChangeStatus.APPROVED })
            .andWhere('(scr.start_datetime <= :endDate AND scr.end_datetime >= :startDate)', { startDate, endDate })
            .getCount();
        if (replacementOverlapping > 0) {
            this.logger.error(`Replacement employee ${dto.replacement_id} has overlapping approved requests`);
            throw new common_1.BadRequestException('Angajatul înlocuitor are deja o cerere aprobată în această perioadă');
        }
        const partial = {
            ...dto,
            duration_unit: dto.duration_unit || 'days',
            start_datetime: startDate,
            end_datetime: endDate,
            status: shift_change_request_entity_1.ShiftChangeStatus.PENDING,
        };
        const shiftChangeRequest = this.shiftChangeRepo.create(partial);
        const savedRequest = await this.shiftChangeRepo.save(shiftChangeRequest);
        this.logger.log(`Shift change request ${savedRequest.id} created successfully`);
        return this.findOne(savedRequest.id);
    }
    async findAll(filters, currentUserId) {
        this.logger.log(`Fetching shift change requests with filters: ${JSON.stringify(filters)}`);
        const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr');
        if (filters.status) {
            queryBuilder.andWhere('scr.status = :status', { status: filters.status });
        }
        if (filters.employee_id) {
            queryBuilder.andWhere('scr.employee_id = :employeeId', { employeeId: filters.employee_id });
        }
        if (filters.replacement_id) {
            queryBuilder.andWhere('scr.replacement_id = :replacementId', { replacementId: filters.replacement_id });
        }
        if (filters.start_date && filters.end_date) {
            queryBuilder.andWhere('scr.start_datetime >= :startDate AND scr.end_datetime <= :endDate', { startDate: new Date(filters.start_date), endDate: new Date(filters.end_date) });
        }
        else if (filters.start_date) {
            queryBuilder.andWhere('scr.start_datetime >= :startDate', { startDate: new Date(filters.start_date) });
        }
        else if (filters.end_date) {
            queryBuilder.andWhere('scr.end_datetime <= :endDate', { endDate: new Date(filters.end_date) });
        }
        if (filters.reviewed_by_id) {
            queryBuilder.andWhere('scr.reviewed_by_id = :reviewerId', { reviewerId: filters.reviewed_by_id });
        }
        if (currentUserId && !this.isManager(currentUserId)) {
            queryBuilder.andWhere('(scr.employee_id = :currentUserId OR scr.replacement_id = :currentUserId)', { currentUserId });
        }
        queryBuilder.orderBy('scr.created_at', 'DESC');
        const requests = await queryBuilder.getMany();
        this.logger.log(`Found ${requests.length} shift change requests`);
        return requests;
    }
    async findPending(currentUserId) {
        this.logger.log('Fetching pending shift change requests');
        return this.findAll({ status: shift_change_request_entity_1.ShiftChangeStatus.PENDING }, currentUserId);
    }
    async findOne(id, currentUserId) {
        const shiftChangeRequest = await this.shiftChangeRepo.findOne({
            where: { id },
        });
        if (!shiftChangeRequest) {
            this.logger.error(`Shift change request with ID ${id} not found`);
            throw new common_1.NotFoundException('Cererea de schimb de tură nu a fost găsită');
        }
        if (currentUserId && !this.isManager(currentUserId)) {
            const isInvolved = shiftChangeRequest.employee_id === currentUserId ||
                shiftChangeRequest.replacement_id === currentUserId;
            if (!isInvolved) {
                this.logger.warn(`User ${currentUserId} attempted to access shift change request ${id} without permission`);
                throw new common_1.ForbiddenException('Nu ai permisiunea să vezi această cerere de schimb de tură');
            }
        }
        return shiftChangeRequest;
    }
    async updateStatus(id, dto, currentUserId) {
        this.logger.log(`Updating status of shift change request ${id} to ${dto.status} by user ${dto.reviewed_by_id}`);
        const shiftChangeRequest = await this.findOne(id);
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService.get(`http://localhost:3012/employees/${dto.reviewed_by_id}`));
        }
        catch (error) {
            this.logger.error(`Reviewer with ID ${dto.reviewed_by_id} not found: ${error.message}`);
            throw new common_1.NotFoundException('Managerul care aprobă nu a fost găsit');
        }
        if (currentUserId && !this.isManager(currentUserId)) {
            this.logger.warn(`Non-manager user ${currentUserId} attempted to update shift change request status`);
            throw new common_1.ForbiddenException('Nu ai permisiunea să aprobi/respingi cereri de schimb de tură');
        }
        if (shiftChangeRequest.status !== shift_change_request_entity_1.ShiftChangeStatus.PENDING) {
            this.logger.error(`Attempted to modify shift change request ${id} with status ${shiftChangeRequest.status}`);
            throw new common_1.BadRequestException('Doar cererile în așteptare pot fi modificate');
        }
        const oldStatus = shiftChangeRequest.status;
        shiftChangeRequest.status = dto.status;
        shiftChangeRequest.reviewed_by_id = dto.reviewed_by_id;
        shiftChangeRequest.reviewed_at = new Date();
        if (dto.review_comment) {
            shiftChangeRequest.comment = shiftChangeRequest.comment
                ? `${shiftChangeRequest.comment}\n\nDecizie manager: ${dto.review_comment}`
                : `Decizie manager: ${dto.review_comment}`;
        }
        const updatedRequest = await this.shiftChangeRepo.save(shiftChangeRequest);
        this.logger.log(`CRITICAL ACTION: Shift change request ${id} status changed from ${oldStatus} to ${dto.status} ` +
            `by manager ${dto.reviewed_by_id} for employee ${shiftChangeRequest.employee_id} -> ${shiftChangeRequest.replacement_id}`);
        return this.findOne(updatedRequest.id);
    }
    async remove(id, currentUserId) {
        const shiftChangeRequest = await this.findOne(id, currentUserId);
        if (shiftChangeRequest.status !== shift_change_request_entity_1.ShiftChangeStatus.PENDING) {
            this.logger.error(`Attempted to delete shift change request ${id} with status ${shiftChangeRequest.status}`);
            throw new common_1.BadRequestException('Doar cererile în așteptare pot fi șterse');
        }
        if (currentUserId && shiftChangeRequest.employee_id !== currentUserId) {
            this.logger.warn(`User ${currentUserId} attempted to delete shift change request ${id} of employee ${shiftChangeRequest.employee_id}`);
            throw new common_1.ForbiddenException('Nu poți șterge cereri de schimb de tură ale altor angajați');
        }
        await this.shiftChangeRepo.remove(shiftChangeRequest);
        this.logger.log(`Shift change request ${id} deleted by employee ${shiftChangeRequest.employee_id}`);
    }
    async getEmployeeStats(employeeId, year) {
        const currentYear = year || new Date().getFullYear();
        const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr')
            .where('(scr.employee_id = :employeeId OR scr.replacement_id = :employeeId)', { employeeId })
            .andWhere('YEAR(scr.start_datetime) = :year', { year: currentYear });
        const totalRequests = await queryBuilder.getCount();
        const asRequester = await queryBuilder
            .clone()
            .andWhere('scr.employee_id = :employeeId', { employeeId })
            .getCount();
        const asReplacement = await queryBuilder
            .clone()
            .andWhere('scr.replacement_id = :employeeId', { employeeId })
            .getCount();
        const approvedRequests = await queryBuilder
            .clone()
            .andWhere('scr.status = :status', { status: shift_change_request_entity_1.ShiftChangeStatus.APPROVED })
            .getCount();
        const pendingRequests = await queryBuilder
            .clone()
            .andWhere('scr.status = :status', { status: shift_change_request_entity_1.ShiftChangeStatus.PENDING })
            .getCount();
        const rejectedRequests = await queryBuilder
            .clone()
            .andWhere('scr.status = :status', { status: shift_change_request_entity_1.ShiftChangeStatus.REJECTED })
            .getCount();
        this.logger.log(`Generated stats for employee ${employeeId} for year ${currentYear}`);
        return {
            year: currentYear,
            total_requests: totalRequests,
            as_requester: asRequester,
            as_replacement: asReplacement,
            approved_requests: approvedRequests,
            pending_requests: pendingRequests,
            rejected_requests: rejectedRequests,
        };
    }
    async isManager(userId) {
        return userId > 100;
    }
    async findRequestsForApproval(managerId) {
        this.logger.log(`Fetching shift change requests for approval by manager ${managerId}`);
        return this.findAll({ status: shift_change_request_entity_1.ShiftChangeStatus.PENDING }, managerId);
    }
    async findByEmployee(employeeId, currentUserId) {
        this.logger.log(`Fetching shift change requests for employee ${employeeId}`);
        if (currentUserId && !this.isManager(currentUserId) && currentUserId !== employeeId) {
            throw new common_1.ForbiddenException('Nu poți vedea cererile altor angajați');
        }
        return this.shiftChangeRepo.find({
            where: [
                { employee_id: employeeId },
                { replacement_id: employeeId }
            ],
            order: { created_at: 'DESC' },
        });
    }
};
exports.ShiftChangeRequestsService = ShiftChangeRequestsService;
exports.ShiftChangeRequestsService = ShiftChangeRequestsService = ShiftChangeRequestsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(shift_change_request_entity_1.ShiftChangeRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        axios_1.HttpService])
], ShiftChangeRequestsService);
//# sourceMappingURL=shift-change-requests.service.js.map
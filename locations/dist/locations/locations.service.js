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
exports.LocationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const work_location_entity_1 = require("../locations/entity/work-location.entity");
const work_location_task_template_entity_1 = require("../locations/entity/work-location-task-template.entity");
const work_location_departments_entity_1 = require("../locations/entity/work-location-departments.entity");
const work_location_department_positions_entity_1 = require("../locations/entity/work-location-department-positions.entity");
const work_location_revenue_entity_1 = require("./entity/work-location-revenue.entity");
const work_location_revenue_points_entity_1 = require("./entity/work-location-revenue-points.entity");
const work_location_manager_config_entity_1 = require("./entity/work-location-manager-config.entity");
let LocationsService = class LocationsService {
    constructor(workLocationRepository, taskTemplateRepository, departmentsRepository, positionsRepository, revenueRepository, revenuePointsRepository, managerConfigRepository) {
        this.workLocationRepository = workLocationRepository;
        this.taskTemplateRepository = taskTemplateRepository;
        this.departmentsRepository = departmentsRepository;
        this.positionsRepository = positionsRepository;
        this.revenueRepository = revenueRepository;
        this.revenuePointsRepository = revenuePointsRepository;
        this.managerConfigRepository = managerConfigRepository;
    }
    async createWorkLocation(dto) {
        const entity = this.workLocationRepository.create(dto);
        const saved = await this.workLocationRepository.save(entity);
        return saved;
    }
    async findAllWorkLocations(page = 1, limit = 10, companyId, city, search) {
        const qb = this.workLocationRepository
            .createQueryBuilder('location')
            .leftJoinAndSelect('location.task_templates', 'task_templates');
        if (companyId)
            qb.where('location.company_id = :companyId', { companyId });
        if (city)
            qb.andWhere('location.city = :city', { city });
        if (search)
            qb.andWhere('location.location_name LIKE :search OR location.address LIKE :search', { search: `%${search}%` });
        const offset = (page - 1) * limit;
        const [locations, total] = await qb
            .orderBy('location.created_at', 'DESC')
            .skip(offset)
            .take(limit)
            .getManyAndCount();
        return { locations, total, totalPages: Math.ceil(total / limit) };
    }
    async findWorkLocationById(id) {
        const workLocation = await this.workLocationRepository.findOne({
            where: { id },
            relations: ['task_templates'],
        });
        if (!workLocation)
            throw new common_1.NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
        return workLocation;
    }
    async findWorkLocationsByCompany(companyId) {
        return await this.workLocationRepository.find({
            where: { company_id: companyId },
            relations: ['task_templates'],
            order: { id: 'DESC' },
        });
    }
    async updateWorkLocation(id, dto) {
        const workLocation = await this.findWorkLocationById(id);
        Object.assign(workLocation, dto);
        return await this.workLocationRepository.save(workLocation);
    }
    async removeWorkLocation(id) {
        const workLocation = await this.findWorkLocationById(id);
        await this.workLocationRepository.remove(workLocation);
    }
    async createTaskTemplateAssignment(dto) {
        await this.findWorkLocationById(dto.location_id);
        const existing = await this.taskTemplateRepository.findOne({
            where: {
                location_id: dto.location_id,
                template_id: dto.template_id || 1,
                active: true,
            },
        });
        if (existing)
            throw new common_1.BadRequestException(`Template-ul ${dto.template_id || 1} este deja atribuit activ la această locație`);
        const assignment = this.taskTemplateRepository.create({
            ...dto,
            assigned_at: new Date(),
        });
        return await this.taskTemplateRepository.save(assignment);
    }
    async findAllTaskTemplateAssignments(page = 1, limit = 10, locationId, templateId, active) {
        const qb = this.taskTemplateRepository
            .createQueryBuilder('assignment')
            .leftJoinAndSelect('assignment.work_location', 'work_location');
        if (locationId)
            qb.where('assignment.location_id = :locationId', { locationId });
        if (templateId)
            qb.andWhere('assignment.template_id = :templateId', { templateId });
        if (active !== undefined)
            qb.andWhere('assignment.active = :active', { active });
        const offset = (page - 1) * limit;
        const [assignments, total] = await qb
            .orderBy('assignment.assigned_at', 'DESC')
            .skip(offset)
            .take(limit)
            .getManyAndCount();
        return { assignments, total, totalPages: Math.ceil(total / limit) };
    }
    async findTaskTemplateAssignmentById(id) {
        const assignment = await this.taskTemplateRepository.findOne({
            where: { id },
            relations: ['work_location'],
        });
        if (!assignment)
            throw new common_1.NotFoundException(`Atribuirea cu ID-ul ${id} nu a fost găsită`);
        return assignment;
    }
    async findTaskTemplateAssignmentsByLocation(locationId) {
        await this.findWorkLocationById(locationId);
        return await this.taskTemplateRepository.find({
            where: { location_id: locationId },
            relations: ['work_location'],
            order: { assigned_at: 'DESC' },
        });
    }
    async findDepartmentsByLocation(locationId) {
        return this.departmentsRepository.find({ where: { work_location_id: locationId }, order: { name: 'ASC' } });
    }
    async createDepartment(dto) {
        const row = this.departmentsRepository.create({
            work_location_id: dto.work_location_id,
            name: dto.name,
            code: dto.code,
            description: dto.description ?? null,
        });
        return this.departmentsRepository.save(row);
    }
    async findPositionsByDepartment(departmentId) {
        return this.positionsRepository.find({ where: { department_id: departmentId }, order: { name: 'ASC' } });
    }
    async createDepartmentPosition(dto) {
        const row = this.positionsRepository.create({
            department_id: dto.department_id,
            name: dto.name,
            code: dto.code,
            description: dto.description ?? null,
        });
        return this.positionsRepository.save(row);
    }
    async updateTaskTemplateAssignment(id, dto) {
        const assignment = await this.findTaskTemplateAssignmentById(id);
        Object.assign(assignment, dto);
        return await this.taskTemplateRepository.save(assignment);
    }
    async removeTaskTemplateAssignment(id) {
        const assignment = await this.findTaskTemplateAssignmentById(id);
        await this.taskTemplateRepository.remove(assignment);
    }
    async deactivateTemplateAssignments(templateId) {
        await this.taskTemplateRepository.update({ template_id: templateId }, { active: false });
    }
    async toggleAssignmentStatus(id, active) {
        const assignment = await this.findTaskTemplateAssignmentById(id);
        assignment.active = active;
        return await this.taskTemplateRepository.save(assignment);
    }
    async getLocationStatistics() {
        const total_locations = await this.workLocationRepository.count();
        const total_assignments = await this.taskTemplateRepository.count();
        const active_assignments = await this.taskTemplateRepository.count({
            where: { active: true },
        });
        return {
            total_locations,
            locations_by_company: [],
            total_assignments,
            active_assignments,
        };
    }
    async setRevenueIntervals(workLocationId, intervals) {
        const wl = await this.findWorkLocationById(workLocationId);
        await this.revenuePointsRepository.delete({ work_location_id: workLocationId });
        const rows = intervals.map(i => ({
            work_location_id: workLocationId,
            min_revenue: i.min,
            max_revenue: (i.max ?? null),
            points: i.points,
        }));
        return this.revenuePointsRepository.save(rows);
    }
    async getRevenueIntervals(workLocationId) {
        await this.findWorkLocationById(workLocationId);
        return this.revenuePointsRepository.find({
            where: { work_location_id: workLocationId },
            order: { min_revenue: 'ASC' },
        });
    }
    async setManagerPercent(workLocationId, managerPercent, _fallbackRevenuePerPoint) {
        let cfg = await this.managerConfigRepository.findOne({ where: { work_location_id: workLocationId } });
        if (!cfg) {
            cfg = this.managerConfigRepository.create({
                work_location_id: workLocationId,
                manager_percent: managerPercent,
            });
        }
        else {
            cfg.manager_percent = managerPercent;
        }
        return this.managerConfigRepository.save(cfg);
    }
    async getManagerConfig(workLocationId) {
        await this.findWorkLocationById(workLocationId);
        return this.managerConfigRepository.findOne({ where: { work_location_id: workLocationId } });
    }
    async recordRevenue(workLocationId, revenueDate, revenueAmount) {
        await this.findWorkLocationById(workLocationId);
        const row = this.revenueRepository.create({
            work_location_id: workLocationId,
            revenue_date: revenueDate,
            revenue_amount: revenueAmount,
        });
        return this.revenueRepository.save(row);
    }
    async listRevenue(workLocationId, opts) {
        await this.findWorkLocationById(workLocationId);
        const page = Math.max(1, Number(opts?.page || 1));
        const limit = Math.max(1, Math.min(200, Number(opts?.limit || 50)));
        const qb = this.revenueRepository
            .createQueryBuilder('rev')
            .where('rev.location_id = :workLocationId', { workLocationId })
            .orderBy('rev.revenue_date', 'DESC');
        if (opts?.startDate)
            qb.andWhere('rev.revenue_date >= :startDate', { startDate: opts.startDate });
        if (opts?.endDate)
            qb.andWhere('rev.revenue_date <= :endDate', { endDate: opts.endDate });
        const offset = (page - 1) * limit;
        const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
        return { revenues: items, total, totalPages: Math.ceil(total / limit) };
    }
    async getManagerPointsForDate(workLocationId, revenueDate) {
        const cfg = await this.managerConfigRepository.findOne({ where: { work_location_id: workLocationId } });
        if (!cfg)
            return { totalPoints: 0, managerPoints: 0, managerPercent: 0, breakdown: [] };
        const revs = await this.revenueRepository.find({ where: { work_location_id: workLocationId, revenue_date: revenueDate } });
        if (!revs || revs.length === 0)
            return { totalPoints: 0, managerPoints: 0, managerPercent: Number(cfg.manager_percent), breakdown: [] };
        const intervals = await this.revenuePointsRepository.find({ where: { work_location_id: workLocationId }, order: { min_revenue: 'ASC' } });
        let totalPoints = 0;
        let totalManagerPoints = 0;
        const breakdown = [];
        for (const rev of revs) {
            let pointsPerUnit = null;
            let matched = null;
            for (const intv of intervals) {
                const minOk = Number(rev.revenue_amount) >= Number(intv.min_revenue);
                const maxOk = intv.max_revenue == null ? true : Number(rev.revenue_amount) <= Number(intv.max_revenue);
                if (minOk && maxOk) {
                    pointsPerUnit = Number(intv.points);
                    matched = { min: Number(intv.min_revenue), max: intv.max_revenue == null ? null : Number(intv.max_revenue) };
                    break;
                }
            }
            if (!pointsPerUnit || pointsPerUnit <= 0)
                continue;
            const amount = Number(rev.revenue_amount);
            const pts = amount / pointsPerUnit;
            totalPoints += pts;
            const managerPts = pts * (Number(cfg.manager_percent) / 100);
            totalManagerPoints += managerPts;
            breakdown.push({ amount, pointsPerUnit, interval: matched, points: pts, managerShare: managerPts });
        }
        return { totalPoints, managerPoints: totalManagerPoints, managerPercent: Number(cfg.manager_percent), breakdown };
    }
};
exports.LocationsService = LocationsService;
exports.LocationsService = LocationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(work_location_entity_1.WorkLocation)),
    __param(1, (0, typeorm_1.InjectRepository)(work_location_task_template_entity_1.WorkLocationTaskTemplate)),
    __param(2, (0, typeorm_1.InjectRepository)(work_location_departments_entity_1.WorkLocationDepartments)),
    __param(3, (0, typeorm_1.InjectRepository)(work_location_department_positions_entity_1.WorkLocationDepartmentPositions)),
    __param(4, (0, typeorm_1.InjectRepository)(work_location_revenue_entity_1.WorkLocationRevenue)),
    __param(5, (0, typeorm_1.InjectRepository)(work_location_revenue_points_entity_1.WorkLocationRevenuePoints)),
    __param(6, (0, typeorm_1.InjectRepository)(work_location_manager_config_entity_1.WorkLocationManagerConfig)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], LocationsService);
//# sourceMappingURL=locations.service.js.map
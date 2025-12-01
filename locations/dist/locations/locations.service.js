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
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
const path = require("path");
const fs = require("fs");
const axios_1 = require("axios");
const work_location_entity_1 = require("../locations/entity/work-location.entity");
const work_location_task_template_entity_1 = require("../locations/entity/work-location-task-template.entity");
const work_location_departments_entity_1 = require("../locations/entity/work-location-departments.entity");
const work_location_department_positions_entity_1 = require("../locations/entity/work-location-department-positions.entity");
const work_location_revenue_entity_1 = require("./entity/work-location-revenue.entity");
const work_location_revenue_points_entity_1 = require("./entity/work-location-revenue-points.entity");
const work_location_manager_config_entity_1 = require("./entity/work-location-manager-config.entity");
const work_location_files_entity_1 = require("./entity/work-location-files.entity");
let LocationsService = class LocationsService {
    constructor(workLocationRepository, taskTemplateRepository, departmentsRepository, positionsRepository, revenueRepository, revenuePointsRepository, managerConfigRepository, filesRepository, notificationsClient, dataSource) {
        this.workLocationRepository = workLocationRepository;
        this.taskTemplateRepository = taskTemplateRepository;
        this.departmentsRepository = departmentsRepository;
        this.positionsRepository = positionsRepository;
        this.revenueRepository = revenueRepository;
        this.revenuePointsRepository = revenuePointsRepository;
        this.managerConfigRepository = managerConfigRepository;
        this.filesRepository = filesRepository;
        this.notificationsClient = notificationsClient;
        this.dataSource = dataSource;
    }
    getLocationsFilesRootDir() {
        const repoRoot = path.resolve(__dirname, '../../../..');
        return path.join(repoRoot, 'files', 'locations');
    }
    async sendLocationNotification(type, title, description, locationId, metadata) {
        try {
            console.log(`🔍 [LOCATIONS SERVICE] Sending notification - Type: ${type}, Location ID: ${locationId}`);
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: 'locations.notification' }, {
                type,
                title,
                description,
                entity_id: locationId,
                entity_type: 'location',
                metadata,
                priority: 'medium',
            }));
            console.log(`✅ [LOCATIONS SERVICE] Notification sent successfully - Type: ${type}, Location ID: ${locationId}`);
        }
        catch (error) {
            console.error('Failed to send location notification:', error);
        }
    }
    async createWorkLocation(dto) {
        const entity = this.workLocationRepository.create(dto);
        const saved = await this.workLocationRepository.save(entity);
        await this.sendLocationNotification('location_created', 'Locatie noua adaugata', `A fost adaugata o noua locatie: ${saved.location_name}`, saved.id, { locationName: saved.location_name });
        return saved;
    }
    async findAllWorkLocations(page = 1, limit = 10, companyId, city, search, user) {
        const hasLocationReadPermission = user?.permissions?.includes('locations.read');
        if (hasLocationReadPermission) {
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
        const employeeId = user?.id || user?.employee_id || user?.userId;
        if (!employeeId) {
            return { locations: [], total: 0, totalPages: 0 };
        }
        console.log(`🔍 [findAllWorkLocations] Employee ID: ${employeeId}, JWT fields:`, {
            work_location_id: user?.work_location_id,
            work_location_default_id: user?.work_location_default_id,
            hasPermissions: !!user?.permissions,
        });
        let employeeLocationIds = [];
        try {
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
            const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                headers: {
                    'x-internal-service': 'locations',
                    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                    'Content-Type': 'application/json',
                },
                timeout: 3000,
            });
            const employeeLocations = Array.isArray(response.data) ? response.data : [];
            employeeLocationIds = employeeLocations.map((el) => {
                return el.idLocation || el.id_location || el.locationId || el.location_id;
            }).filter((id) => id != null).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
            const workLocationId = user.work_location_id || user.work_location_default_id;
            if (workLocationId) {
                const workLocId = parseInt(String(workLocationId), 10);
                if (!isNaN(workLocId)) {
                    employeeLocationIds.push(workLocId);
                }
            }
            employeeLocationIds = [...new Set(employeeLocationIds)];
        }
        catch (error) {
            if (error.code !== 'ECONNREFUSED' && error.code !== 'ETIMEDOUT') {
                console.error(`Failed to fetch employee locations: ${error.message}`);
            }
            const workLocationId = user.work_location_id || user.work_location_default_id;
            if (workLocationId) {
                const workLocId = parseInt(String(workLocationId), 10);
                if (!isNaN(workLocId)) {
                    employeeLocationIds = [workLocId];
                    console.warn(`⚠️ Employees microservice not accessible, using work_location_id from JWT: ${workLocId}`);
                }
            }
            if (employeeLocationIds.length === 0) {
                try {
                    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
                    const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`, [employeeId]);
                    if (result && result.length > 0) {
                        employeeLocationIds = result.map((row) => row.id_location || row.idLocation)
                            .filter((id) => id != null)
                            .map((id) => parseInt(id, 10))
                            .filter((id) => !isNaN(id));
                        console.log(`✅ Found ${employeeLocationIds.length} locations in employees_locations via direct DB query (employee ${employeeId}): [${employeeLocationIds.join(', ')}]`);
                    }
                    else {
                        console.warn(`⚠️ No locations found in employees_locations for employee ${employeeId}`);
                        return { locations: [], total: 0, totalPages: 0 };
                    }
                }
                catch (dbError) {
                    console.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
                    console.warn(`⚠️ Cannot access employees_locations - allowing access to all locations for authenticated user (temporary solution)`);
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
            }
        }
        if (employeeLocationIds.length === 0) {
            return { locations: [], total: 0, totalPages: 0 };
        }
        const qb = this.workLocationRepository
            .createQueryBuilder('location')
            .leftJoinAndSelect('location.task_templates', 'task_templates')
            .where('location.id IN (:...locationIds)', { locationIds: employeeLocationIds });
        if (companyId)
            qb.andWhere('location.company_id = :companyId', { companyId });
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
    async getEmployeeCompanies(user) {
        const employeeId = user?.id || user?.employee_id || user?.userId;
        if (!employeeId) {
            return [];
        }
        let employeeLocationIds = [];
        try {
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
            const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                headers: {
                    'x-internal-service': 'locations',
                    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                    'Content-Type': 'application/json',
                },
                timeout: 3000,
            });
            const employeeLocations = Array.isArray(response.data) ? response.data : [];
            employeeLocationIds = employeeLocations.map((el) => {
                return el.idLocation || el.id_location || el.locationId || el.location_id;
            }).filter((id) => id != null).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
            const workLocationId = user.work_location_id || user.work_location_default_id;
            if (workLocationId) {
                const workLocId = parseInt(String(workLocationId), 10);
                if (!isNaN(workLocId)) {
                    employeeLocationIds.push(workLocId);
                }
            }
            employeeLocationIds = [...new Set(employeeLocationIds)];
        }
        catch (error) {
            const workLocationId = user.work_location_id || user.work_location_default_id;
            if (workLocationId) {
                employeeLocationIds = [workLocationId];
            }
            else {
                try {
                    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
                    const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`, [employeeId]);
                    if (result && result.length > 0) {
                        employeeLocationIds = result.map((row) => row.id_location || row.idLocation)
                            .filter((id) => id != null)
                            .map((id) => parseInt(id, 10))
                            .filter((id) => !isNaN(id));
                    }
                }
                catch (dbError) {
                    return [];
                }
            }
        }
        if (employeeLocationIds.length === 0) {
            return [];
        }
        const locations = await this.workLocationRepository.find({
            where: { id: (0, typeorm_2.In)(employeeLocationIds) },
            select: ['id', 'company_id'],
        });
        const companyIds = [...new Set(locations.map(loc => loc.company_id).filter(id => id != null))];
        if (companyIds.length === 0) {
            return [];
        }
        const companies = [];
        const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://giurom.bitap.ro:3003';
        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
        for (const companyId of companyIds) {
            try {
                const requestHeaders = {
                    'x-internal-service': 'locations',
                    'x-service-secret': serviceSecret,
                    'Content-Type': 'application/json',
                };
                console.log(`🔍 [getEmployeeCompanies] Requesting company ${companyId} from ${companiesUrl}/companies/${companyId} with headers:`, requestHeaders);
                const response = await axios_1.default.get(`${companiesUrl}/companies/${companyId}`, {
                    headers: requestHeaders,
                    timeout: 3000,
                });
                if (response.data && response.data.company_name) {
                    companies.push({
                        id: companyId,
                        company_name: response.data.company_name,
                    });
                }
            }
            catch (error) {
                console.warn(`⚠️ Nu am putut obține numele companiei ${companyId}: ${error.message}`);
            }
        }
        return companies;
    }
    async findWorkLocationById(id, user) {
        const workLocation = await this.workLocationRepository.findOne({
            where: { id },
            relations: ['task_templates'],
        });
        if (!workLocation)
            throw new common_1.NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
        const hasLocationReadPermission = user?.permissions?.includes('locations.read');
        if (!hasLocationReadPermission && user) {
            const employeeId = user.id || user.employee_id || user.userId;
            const userWorkLocationId = user.work_location_id;
            if (userWorkLocationId && userWorkLocationId === id) {
                return workLocation;
            }
            if (employeeId) {
                try {
                    const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
                    const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                        headers: {
                            'x-internal-service': 'locations',
                            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                            'Content-Type': 'application/json',
                        },
                        timeout: 3000,
                    });
                    const employeeLocations = Array.isArray(response.data) ? response.data : [];
                    const hasAccess = employeeLocations.some((el) => {
                        const elLocationId = el.idLocation || el.id_location || el.locationId || el.location_id;
                        return elLocationId === id || String(elLocationId) === String(id);
                    });
                    if (hasAccess) {
                        return workLocation;
                    }
                }
                catch (error) {
                    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                        try {
                            const workLocationId = user.work_location_id || user.work_location_default_id;
                            if (workLocationId && workLocationId === id) {
                                return workLocation;
                            }
                            const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
                            const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ? AND id_location = ?`, [employeeId, id]);
                            if (result && result.length > 0) {
                                console.log(`✅ Found location ${id} in employees_locations via direct DB query for employee ${employeeId}`);
                                return workLocation;
                            }
                            throw new common_1.ForbiddenException('Nu ai acces la această locație');
                        }
                        catch (dbError) {
                            console.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
                            const workLocationId = user.work_location_id || user.work_location_default_id;
                            if (workLocationId && workLocationId === id) {
                                return workLocation;
                            }
                            throw new common_1.ForbiddenException('Nu ai acces la această locație');
                        }
                    }
                }
            }
            throw new common_1.ForbiddenException('Nu ai acces la această locație');
        }
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
        const oldName = workLocation.location_name;
        Object.assign(workLocation, dto);
        const updatedLocation = await this.workLocationRepository.save(workLocation);
        await this.sendLocationNotification('location_updated', 'Locatie modificata', `Locatia ${oldName} a fost modificata`, updatedLocation.id, {
            oldName,
            newName: updatedLocation.location_name,
            updatedFields: Object.keys(dto)
        });
        return updatedLocation;
    }
    async removeWorkLocation(id) {
        const workLocation = await this.findWorkLocationById(id);
        const locationName = workLocation.location_name;
        const departmentsCount = await this.departmentsRepository.count({
            where: { work_location_id: id }
        });
        const revenuePointsCount = await this.revenuePointsRepository.count({
            where: { work_location_id: id }
        });
        await this.sendLocationNotification('location_deleted', 'Locatie stearsa', `Locatia ${locationName} a fost stearsa (Departamente: ${departmentsCount}, Puncte: ${revenuePointsCount}, Angajati afectati)`, id, {
            locationName,
            departmentsCount,
            revenuePointsCount
        });
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
    async recordRevenue(workLocationId, revenueDate, onlineAmount, cashAmount, cardAmount, totalAmount, status, imageUrl, userId) {
        await this.findWorkLocationById(workLocationId);
        const row = this.revenueRepository.create({
            work_location_id: workLocationId,
            revenue_date: revenueDate,
            online_amount: onlineAmount,
            cash_amount: cashAmount,
            card_amount: cardAmount,
            total_amount: totalAmount,
            status: status,
            image_url: imageUrl,
            user_id: userId || null,
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
        const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
        const revenuesWithEmployeeId = await Promise.all(items.map(async (rev) => {
            if (!rev.user_id) {
                return { ...rev, employee_id: null };
            }
            try {
                const userResult = await this.dataSource.query(`SELECT id_employee FROM ${authDbName}.users WHERE id = ?`, [rev.user_id]);
                if (userResult && userResult.length > 0 && userResult[0].id_employee) {
                    const employeeId = Number(userResult[0].id_employee);
                    const employeeResult = await this.dataSource.query(`SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`, [employeeId]);
                    if (employeeResult && employeeResult.length > 0) {
                        return {
                            ...rev,
                            employee_id: employeeId,
                            employee_first_name: employeeResult[0].first_name || null,
                            employee_last_name: employeeResult[0].last_name || null,
                        };
                    }
                    return { ...rev, employee_id: employeeId };
                }
            }
            catch (error) {
                console.error(`❌ Error fetching employee data for user_id ${rev.user_id}:`, error.message);
            }
            return { ...rev, employee_id: null };
        }));
        return { revenues: revenuesWithEmployeeId, total, totalPages: Math.ceil(total / limit) };
    }
    async deleteRevenue(revenueId) {
        const revenue = await this.revenueRepository.findOne({ where: { id: revenueId } });
        if (!revenue)
            throw new common_1.NotFoundException(`Încasarea cu ID-ul ${revenueId} nu a fost găsită`);
        await this.revenueRepository.remove(revenue);
    }
    async updateRevenue(revenueId, data) {
        const revenue = await this.revenueRepository.findOne({ where: { id: revenueId } });
        if (!revenue)
            throw new common_1.NotFoundException(`Încasarea cu ID-ul ${revenueId} nu a fost găsită`);
        const wasApproved = revenue.status === work_location_revenue_entity_1.RevenueStatus.Approved;
        const becomingApproved = data.status === work_location_revenue_entity_1.RevenueStatus.Approved;
        const shouldCalculateBonuses = becomingApproved && !wasApproved;
        const revenueDateRaw = data.revenue_date || revenue.revenue_date;
        const revenueDate = revenueDateRaw ? revenueDateRaw.toString().split(' ')[0].split('T')[0] : null;
        if (data.revenue_date)
            revenue.revenue_date = data.revenue_date;
        if (data.online_amount !== undefined)
            revenue.online_amount = data.online_amount;
        if (data.cash_amount !== undefined)
            revenue.cash_amount = data.cash_amount;
        if (data.card_amount !== undefined)
            revenue.card_amount = data.card_amount;
        if (data.total_amount !== undefined)
            revenue.total_amount = data.total_amount;
        if (data.status !== undefined)
            revenue.status = data.status;
        if (data.image_url !== undefined)
            revenue.image_url = data.image_url;
        const savedRevenue = await this.revenueRepository.save(revenue);
        if (shouldCalculateBonuses && revenueDate) {
            console.log(`🔔 [BONUS TRIGGER] Revenue ${revenueId} approved. Calculating bonuses for revenue_date: ${revenueDate} (date of revenue, not approval date)`);
            this.calculateEmployeeBonusesForDate(revenue.work_location_id, revenueDate).catch(err => {
                console.error(`❌ [BONUS TRIGGER] Error calculating bonuses for revenue ${revenueId}:`, err);
            });
        }
        return savedRevenue;
    }
    async calculateEmployeeBonusesForDate(locationId, revenueDate) {
        try {
            const normalizedDate = revenueDate.toString().split(' ')[0].split('T')[0];
            console.log(`🔍 [BONUS CALC] Starting bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`);
            const approvedRevenues = await this.revenueRepository
                .createQueryBuilder('revenue')
                .where('revenue.work_location_id = :locationId', { locationId })
                .andWhere('DATE(revenue.revenue_date) = :revenueDate', { revenueDate: normalizedDate })
                .andWhere('revenue.status = :status', { status: work_location_revenue_entity_1.RevenueStatus.Approved })
                .getMany();
            if (!approvedRevenues || approvedRevenues.length === 0) {
                console.log(`⚠️ [BONUS CALC] No approved revenues found for location ${locationId}, date ${revenueDate}`);
                return;
            }
            const intervals = await this.revenuePointsRepository.find({
                where: { work_location_id: locationId },
                order: { min_revenue: 'ASC' }
            });
            const managerCfg = await this.managerConfigRepository.findOne({
                where: { work_location_id: locationId }
            });
            const fallback = 0;
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
            let employees = [];
            try {
                const response = await axios_1.default.get(`${employeesUrl}/locations/${locationId}/employees`, {
                    headers: { 'Content-Type': 'application/json' }
                });
                employees = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : [];
                console.log(`👥 [BONUS CALC] Found ${employees.length} employees in location ${locationId}`);
            }
            catch (error) {
                console.error(`❌ [BONUS CALC] Failed to fetch employees for location ${locationId}:`, error);
                return;
            }
            const pickMultiplier = (totalAmount) => {
                for (const intv of intervals) {
                    const minOk = totalAmount >= Number(intv.min_revenue);
                    const maxOk = intv.max_revenue == null ? true : totalAmount <= Number(intv.max_revenue);
                    if (minOk && maxOk) {
                        return Number(intv.points);
                    }
                }
                return fallback;
            };
            const tasksApiUrl = process.env.TASKS_API_BASE || 'http://giurom.bitap.ro:3008';
            const workDate = new Date(revenueDate);
            workDate.setHours(0, 0, 0, 0);
            for (const employee of employees) {
                try {
                    const employeeId = Number(employee.id || employee.employee_id);
                    if (!employeeId)
                        continue;
                    let employeePoints = 0;
                    try {
                        const pointsUrl = `${tasksApiUrl}/executions/daily-points/${employeeId}/${normalizedDate}`;
                        const pointsResponse = await axios_1.default.get(pointsUrl, {
                            headers: { 'Content-Type': 'application/json' }
                        });
                        const pointsData = pointsResponse.data;
                        employeePoints = Number(pointsData?.total_points || pointsData?.data?.total_points || 0);
                    }
                    catch (error) {
                        console.log(`⚠️ [BONUS CALC] Could not fetch points for employee ${employeeId}, revenue_date: ${normalizedDate}`);
                        try {
                            const rangeUrl = `${tasksApiUrl}/executions/employee-points/${employeeId}?startDate=${normalizedDate}&endDate=${normalizedDate}`;
                            const rangeResponse = await axios_1.default.get(rangeUrl, {
                                headers: { 'Content-Type': 'application/json' }
                            });
                            const rangeData = Array.isArray(rangeResponse.data) ? rangeResponse.data : Array.isArray(rangeResponse.data?.data) ? rangeResponse.data.data : [];
                            if (rangeData.length > 0) {
                                employeePoints = Number(rangeData[0]?.total_points || rangeData[0]?.points || 0);
                            }
                        }
                        catch (rangeError) {
                            console.log(`⚠️ [BONUS CALC] Could not fetch points from range endpoint for employee ${employeeId}, revenue_date: ${normalizedDate}`);
                        }
                    }
                    if (employeePoints <= 0) {
                        console.log(`⚠️ [BONUS CALC] Employee ${employeeId} has no points for revenue_date: ${normalizedDate}, skipping`);
                        continue;
                    }
                    let totalBonus = 0;
                    for (const revenue of approvedRevenues) {
                        const totalAmount = Number(revenue.total_amount);
                        const multiplier = pickMultiplier(totalAmount);
                        const bonusForThisRevenue = employeePoints * multiplier;
                        totalBonus += bonusForThisRevenue;
                        console.log(`💰 [BONUS CALC] Employee ${employeeId}: ${employeePoints} points × ${multiplier} (revenue ${totalAmount}) = ${bonusForThisRevenue.toFixed(2)} RON`);
                    }
                    console.log(`✅ [BONUS CALC] Employee ${employeeId} total bonus for revenue_date ${normalizedDate}: ${totalBonus.toFixed(2)} RON`);
                }
                catch (employeeError) {
                    console.error(`❌ [BONUS CALC] Error processing employee ${employee.id}:`, employeeError);
                }
            }
            console.log(`✅ [BONUS CALC] Finished bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`);
        }
        catch (error) {
            console.error(`❌ [BONUS CALC] Error in calculateEmployeeBonusesForDate:`, error);
        }
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
                const minOk = Number(rev.total_amount) >= Number(intv.min_revenue);
                const maxOk = intv.max_revenue == null ? true : Number(rev.total_amount) <= Number(intv.max_revenue);
                if (minOk && maxOk) {
                    pointsPerUnit = Number(intv.points);
                    matched = { min: Number(intv.min_revenue), max: intv.max_revenue == null ? null : Number(intv.max_revenue) };
                    break;
                }
            }
            if (!pointsPerUnit || pointsPerUnit <= 0)
                continue;
            const amount = Number(rev.total_amount);
            const pts = amount / pointsPerUnit;
            totalPoints += pts;
            const managerPts = pts * (Number(cfg.manager_percent) / 100);
            totalManagerPoints += managerPts;
            breakdown.push({ amount, pointsPerUnit, interval: matched, points: pts, managerShare: managerPts });
        }
        return { totalPoints, managerPoints: totalManagerPoints, managerPercent: Number(cfg.manager_percent), breakdown };
    }
    async createFile(createFileDto) {
        console.log('📥 Received createFileDto:', {
            work_location_id: createFileDto.work_location_id,
            file_name: createFileDto.file_name,
            file_type: createFileDto.file_type,
            has_content: !!createFileDto.file_content,
            content_length: createFileDto.file_content?.length || 0
        });
        const location = await this.workLocationRepository.findOne({
            where: { id: createFileDto.work_location_id }
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${createFileDto.work_location_id} nu a fost găsită`);
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileExtension = createFileDto.file_name.split('.').pop() || 'txt';
        const baseFileName = createFileDto.file_name.replace(/\.[^/.]+$/, "") || 'file';
        const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;
        console.log(`📝 Original: ${createFileDto.file_name}, Generated: ${uniqueFileName}`);
        const updatedFileLink = createFileDto.file_link.replace(createFileDto.file_name, uniqueFileName);
        const locationId = createFileDto.work_location_id?.toString() || 'unknown';
        console.log(`📁 Creating directory for location ID: ${locationId}`);
        const baseDir = this.getLocationsFilesRootDir();
        const fileDir = path.join(baseDir, locationId);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        if (createFileDto.file_content) {
            try {
                const filePath = path.join(fileDir, uniqueFileName);
                let base64Data = createFileDto.file_content;
                if (base64Data.includes(',')) {
                    base64Data = base64Data.split(',')[1];
                }
                console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(filePath, buffer);
                console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
            }
            catch (error) {
                console.error('❌ Error saving file to disk:', error);
            }
        }
        const existingFile = await this.filesRepository.findOne({
            where: {
                work_location_id: createFileDto.work_location_id,
                file_name: uniqueFileName
            }
        });
        if (existingFile) {
            throw new common_1.ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru această locație`);
        }
        const file = this.filesRepository.create({
            ...createFileDto,
            file_name: uniqueFileName,
            file_link: updatedFileLink
        });
        const savedFile = await this.filesRepository.save(file);
        console.log(`✅ File record saved to database with ID: ${savedFile.id}`);
        return savedFile;
    }
    async findOneFile(id) {
        const file = await this.filesRepository.findOne({
            where: { id },
            relations: ['workLocation'],
        });
        if (!file) {
            throw new common_1.NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
        }
        return file;
    }
    async findFilesByLocation(work_location_id) {
        const location = await this.workLocationRepository.findOne({
            where: { id: work_location_id }
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${work_location_id} nu a fost găsită`);
        }
        return await this.filesRepository.find({
            where: { work_location_id },
            relations: ['workLocation'],
            order: { updated_at: 'DESC' },
        });
    }
    async serveFile(file_id, forceDownload = false) {
        try {
            console.log(`🔍 [serveFile] Starting to serve file with ID: ${file_id}, forceDownload: ${forceDownload}`);
            const file = await this.findOneFile(file_id);
            console.log(`📄 [serveFile] File metadata retrieved:`, {
                id: file.id,
                name: file.file_name,
                work_location_id: file.work_location_id,
                file_link: file.file_link
            });
            const baseDir = this.getLocationsFilesRootDir();
            console.log(`📁 [serveFile] Base directory: ${baseDir}`);
            const filePath = path.join(baseDir, file.work_location_id.toString(), file.file_name);
            console.log(`📁 [serveFile] Full file path: ${filePath}`);
            console.log(`📁 [serveFile] Path exists check: ${fs.existsSync(filePath)}`);
            const fileDir = path.join(baseDir, file.work_location_id.toString());
            console.log(`📁 [serveFile] Directory path: ${fileDir}`);
            console.log(`📁 [serveFile] Directory exists: ${fs.existsSync(fileDir)}`);
            if (fs.existsSync(fileDir)) {
                const filesInDir = fs.readdirSync(fileDir);
                console.log(`📁 [serveFile] Files in directory:`, filesInDir);
            }
            if (!fs.existsSync(filePath)) {
                console.error(`❌ [serveFile] File not found on disk: ${filePath}`);
                throw new common_1.NotFoundException(`Fișierul nu a fost găsit pe disk la calea: ${filePath}`);
            }
            const mimeType = this.getMimeType(file.file_name);
            console.log(`📋 [serveFile] MIME type determined: ${mimeType}`);
            const fileBuffer = fs.readFileSync(filePath);
            console.log(`✅ [serveFile] File read successfully: ${file.file_name} (${fileBuffer.length} bytes)`);
            return {
                data: fileBuffer.toString('base64'),
                mimeType,
                fileName: file.file_name,
                disposition: forceDownload ? 'attachment' : 'inline',
            };
        }
        catch (error) {
            console.error(`❌ [serveFile] Error serving file ${file_id}:`, error);
            console.error(`❌ [serveFile] Error message:`, error.message);
            console.error(`❌ [serveFile] Error stack:`, error.stack);
            throw error;
        }
    }
    getMimeType(fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'txt': 'text/plain',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
        };
        return mimeTypes[extension || ''] || 'application/octet-stream';
    }
    async removeFile(id) {
        const file = await this.findOneFile(id);
        await this.filesRepository.delete(id);
        return {
            message: `Fișierul "${file.file_name}" al locației ${file.workLocation.location_name} a fost șters cu succes`,
        };
    }
    async findExpiringFiles(targetDate) {
        console.log(`⚠️ [findExpiringFiles] Method called but not yet implemented for targetDate: ${targetDate}`);
        return [];
    }
    async findExpiredFiles() {
        console.log(`⚠️ [findExpiredFiles] Method called but not yet implemented`);
        return [];
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
    __param(7, (0, typeorm_1.InjectRepository)(work_location_files_entity_1.WorkLocationFiles)),
    __param(8, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __param(9, (0, common_1.Inject)(typeorm_2.DataSource)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        microservices_1.ClientProxy,
        typeorm_2.DataSource])
], LocationsService);
//# sourceMappingURL=locations.service.js.map
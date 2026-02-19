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
const work_location_folder_entity_1 = require("./entity/work-location-folder.entity");
let LocationsService = class LocationsService {
    constructor(workLocationRepository, taskTemplateRepository, departmentsRepository, positionsRepository, revenueRepository, revenuePointsRepository, managerConfigRepository, filesRepository, folderRepository, notificationsClient, dataSource) {
        this.workLocationRepository = workLocationRepository;
        this.taskTemplateRepository = taskTemplateRepository;
        this.departmentsRepository = departmentsRepository;
        this.positionsRepository = positionsRepository;
        this.revenueRepository = revenueRepository;
        this.revenuePointsRepository = revenuePointsRepository;
        this.managerConfigRepository = managerConfigRepository;
        this.filesRepository = filesRepository;
        this.folderRepository = folderRepository;
        this.notificationsClient = notificationsClient;
        this.dataSource = dataSource;
    }
    async getEmployeeLocationIdsForAccess(user) {
        const employeeId = user?.id || user?.employee_id || user?.userId;
        if (!employeeId)
            return [];
        try {
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || "http://giurom.bitap.ro:3001";
            const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                headers: {
                    "x-internal-service": "locations",
                    "x-service-secret": process.env.SERVICE_SECRET || "default-service-secret",
                    "Content-Type": "application/json",
                },
                timeout: 3000,
            });
            const employeeLocations = Array.isArray(response.data)
                ? response.data
                : [];
            const ids = employeeLocations
                .map((el) => el.idLocation || el.id_location || el.locationId || el.location_id)
                .filter((id) => id != null)
                .map((id) => parseInt(String(id), 10))
                .filter((id) => Number.isFinite(id) && id > 0);
            const workLocationId = user?.work_location_id || user?.work_location_default_id;
            if (workLocationId) {
                const wl = parseInt(String(workLocationId), 10);
                if (Number.isFinite(wl) && wl > 0)
                    ids.push(wl);
            }
            return [...new Set(ids)];
        }
        catch (_e) {
            const workLocationId = user?.work_location_id || user?.work_location_default_id;
            if (workLocationId) {
                const wl = parseInt(String(workLocationId), 10);
                if (Number.isFinite(wl) && wl > 0)
                    return [wl];
            }
            try {
                const employeesDbName = process.env.EMPLOYEES_DB_NAME || "giurombitap_employees";
                const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`, [employeeId]);
                const ids = (result || [])
                    .map((row) => row.id_location || row.idLocation)
                    .filter((id) => id != null)
                    .map((id) => parseInt(String(id), 10))
                    .filter((id) => Number.isFinite(id) && id > 0);
                return [...new Set(ids)];
            }
            catch (_dbErr) {
                return [];
            }
        }
    }
    async findWorkLocationsByIds(ids, user) {
        const uniqueIds = Array.from(new Set((ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0)));
        if (uniqueIds.length === 0)
            return [];
        const hasLocationReadPermission = user?.permissions?.includes("locations.read");
        if (hasLocationReadPermission) {
            return this.workLocationRepository.find({
                where: { id: (0, typeorm_2.In)(uniqueIds) },
                order: { id: "ASC" },
            });
        }
        const allowedIds = await this.getEmployeeLocationIdsForAccess(user);
        if (allowedIds.length === 0)
            return [];
        const intersection = uniqueIds.filter((id) => allowedIds.includes(id));
        if (intersection.length === 0)
            return [];
        return this.workLocationRepository.find({
            where: { id: (0, typeorm_2.In)(intersection) },
            order: { id: "ASC" },
        });
    }
    getLocationsFilesRootDir() {
        const repoRoot = path.resolve(__dirname, "../../../..");
        return path.join(repoRoot, "files", "locations");
    }
    getRepoRoot() {
        const repoRoot = path.resolve(__dirname, "../../..");
        return repoRoot;
    }
    getFilesCompaniesRoot() {
        return path.join(this.getRepoRoot(), "files", "companies");
    }
    async getCompanyNameForLocation(location) {
        let companyName = "Unknown";
        try {
            const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
            const serviceSecret = process.env.SERVICE_SECRET || "default-service-secret";
            const response = await axios_1.default.get(`${companiesUrl}/companies/${location.company_id}`, {
                headers: {
                    "x-internal-service": "locations",
                    "x-service-secret": serviceSecret,
                    "Content-Type": "application/json",
                },
                timeout: 3000,
            });
            if (response.data?.company_name) {
                companyName = response.data.company_name;
            }
        }
        catch (error) {
            console.warn(`⚠️ Could not fetch company name for company ID ${location.company_id}:`, error?.message);
        }
        return companyName;
    }
    getLocationBasePath(companyName, locationName) {
        return path.join(this.getFilesCompaniesRoot(), companyName, "Locații", locationName);
    }
    async createLocationFolderStructure(location) {
        try {
            let companyName = "Unknown";
            try {
                const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
                const serviceSecret = process.env.SERVICE_SECRET || "default-service-secret";
                const response = await axios_1.default.get(`${companiesUrl}/companies/${location.company_id}`, {
                    headers: {
                        "x-internal-service": "locations",
                        "x-service-secret": serviceSecret,
                        "Content-Type": "application/json",
                    },
                    timeout: 3000,
                });
                if (response.data && response.data.company_name) {
                    companyName = response.data.company_name;
                }
            }
            catch (error) {
                console.warn(`⚠️ Could not fetch company name for company ID ${location.company_id}:`, error.message);
            }
            const companyFilesRootDir = path.resolve(__dirname, "../../../..");
            const companyFilesDir = path.join(companyFilesRootDir, "files", "companies");
            const companyDir = path.join(companyFilesDir, companyName);
            if (!fs.existsSync(companyDir)) {
                fs.mkdirSync(companyDir, { recursive: true });
                console.log(`📁 Created company directory: ${companyDir}`);
            }
            const locationsDir = path.join(companyDir, "Locații");
            if (!fs.existsSync(locationsDir)) {
                fs.mkdirSync(locationsDir, { recursive: true });
                console.log(`📁 Created locations directory: ${locationsDir}`);
            }
            const locationDir = path.join(locationsDir, location.location_name);
            if (!fs.existsSync(locationDir)) {
                fs.mkdirSync(locationDir, { recursive: true });
                console.log(`📁 Created location directory: ${locationDir}`);
            }
            const mandatoryLocationSubfolders = ["Angajați", "Furnizori"];
            for (const subfolder of mandatoryLocationSubfolders) {
                const subfolderPath = path.join(locationDir, subfolder);
                if (!fs.existsSync(subfolderPath)) {
                    fs.mkdirSync(subfolderPath, { recursive: true });
                    console.log(`📁 Created mandatory location subfolder: ${subfolderPath}`);
                }
            }
            console.log(`✅ Folder structure created successfully for location ${location.id}`);
        }
        catch (error) {
            console.error(`❌ Error creating folder structure for location ${location.id}:`, error);
        }
    }
    async sendLocationNotification(type, title, description, locationId, metadata, target_url) {
        try {
            console.log(`🔍 [LOCATIONS SERVICE] Sending notification - Type: ${type}, Location ID: ${locationId}`);
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: "locations.notification" }, {
                type,
                title,
                description,
                entity_id: locationId,
                entity_type: "location",
                metadata,
                priority: "medium",
                target_url,
            }));
            console.log(`✅ [LOCATIONS SERVICE] Notification sent successfully - Type: ${type}, Location ID: ${locationId}`);
        }
        catch (error) {
            console.error("Failed to send location notification:", error);
        }
    }
    async createWorkLocation(dto) {
        const entity = this.workLocationRepository.create(dto);
        const saved = await this.workLocationRepository.save(entity);
        await this.createLocationFolderStructure(saved);
        await this.sendLocationNotification("location_created", "Locatie noua adaugata", `A fost adaugata o noua locatie: ${saved.location_name}`, saved.id, { locationName: saved.location_name }, `/locatii/${saved.id}`);
        return saved;
    }
    async findAllWorkLocations(page = 1, limit = 10, companyId, city, search, user) {
        const hasLocationReadPermission = user?.permissions?.includes("locations.read");
        if (hasLocationReadPermission) {
            const qb = this.workLocationRepository
                .createQueryBuilder("location")
                .leftJoinAndSelect("location.task_templates", "task_templates");
            if (companyId)
                qb.where("location.company_id = :companyId", { companyId });
            if (city)
                qb.andWhere("location.city = :city", { city });
            if (search)
                qb.andWhere("location.location_name LIKE :search OR location.address LIKE :search", { search: `%${search}%` });
            const offset = (page - 1) * limit;
            const [locations, total] = await qb
                .orderBy("location.created_at", "DESC")
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
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || "http://giurom.bitap.ro:3001";
            const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                headers: {
                    "x-internal-service": "locations",
                    "x-service-secret": process.env.SERVICE_SECRET || "default-service-secret",
                    "Content-Type": "application/json",
                },
                timeout: 3000,
            });
            const employeeLocations = Array.isArray(response.data)
                ? response.data
                : [];
            employeeLocationIds = employeeLocations
                .map((el) => {
                return (el.idLocation || el.id_location || el.locationId || el.location_id);
            })
                .filter((id) => id != null)
                .map((id) => parseInt(id, 10))
                .filter((id) => !isNaN(id));
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
            if (error.code !== "ECONNREFUSED" && error.code !== "ETIMEDOUT") {
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
                    const employeesDbName = process.env.EMPLOYEES_DB_NAME || "giurombitap_employees";
                    const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`, [employeeId]);
                    if (result && result.length > 0) {
                        employeeLocationIds = result
                            .map((row) => row.id_location || row.idLocation)
                            .filter((id) => id != null)
                            .map((id) => parseInt(id, 10))
                            .filter((id) => !isNaN(id));
                        console.log(`✅ Found ${employeeLocationIds.length} locations in employees_locations via direct DB query (employee ${employeeId}): [${employeeLocationIds.join(", ")}]`);
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
                        .createQueryBuilder("location")
                        .leftJoinAndSelect("location.task_templates", "task_templates");
                    if (companyId)
                        qb.where("location.company_id = :companyId", { companyId });
                    if (city)
                        qb.andWhere("location.city = :city", { city });
                    if (search)
                        qb.andWhere("location.location_name LIKE :search OR location.address LIKE :search", { search: `%${search}%` });
                    const offset = (page - 1) * limit;
                    const [locations, total] = await qb
                        .orderBy("location.created_at", "DESC")
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
            .createQueryBuilder("location")
            .leftJoinAndSelect("location.task_templates", "task_templates")
            .where("location.id IN (:...locationIds)", {
            locationIds: employeeLocationIds,
        });
        if (companyId)
            qb.andWhere("location.company_id = :companyId", { companyId });
        if (city)
            qb.andWhere("location.city = :city", { city });
        if (search)
            qb.andWhere("location.location_name LIKE :search OR location.address LIKE :search", { search: `%${search}%` });
        const offset = (page - 1) * limit;
        const [locations, total] = await qb
            .orderBy("location.created_at", "DESC")
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
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || "http://giurom.bitap.ro:3001";
            const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                headers: {
                    "x-internal-service": "locations",
                    "x-service-secret": process.env.SERVICE_SECRET || "default-service-secret",
                    "Content-Type": "application/json",
                },
                timeout: 3000,
            });
            const employeeLocations = Array.isArray(response.data)
                ? response.data
                : [];
            employeeLocationIds = employeeLocations
                .map((el) => {
                return (el.idLocation || el.id_location || el.locationId || el.location_id);
            })
                .filter((id) => id != null)
                .map((id) => parseInt(id, 10))
                .filter((id) => !isNaN(id));
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
                    const employeesDbName = process.env.EMPLOYEES_DB_NAME || "giurombitap_employees";
                    const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`, [employeeId]);
                    if (result && result.length > 0) {
                        employeeLocationIds = result
                            .map((row) => row.id_location || row.idLocation)
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
            select: ["id", "company_id"],
        });
        const companyIds = [
            ...new Set(locations.map((loc) => loc.company_id).filter((id) => id != null)),
        ];
        if (companyIds.length === 0) {
            return [];
        }
        const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://giurom.bitap.ro:3003";
        const serviceSecret = process.env.SERVICE_SECRET || "default-service-secret";
        try {
            const requestHeaders = {
                "x-internal-service": "locations",
                "x-service-secret": serviceSecret,
                "Content-Type": "application/json",
            };
            const idsParam = companyIds.join(",");
            const response = await axios_1.default.get(`${companiesUrl}/companies/batch`, {
                headers: requestHeaders,
                params: { ids: idsParam },
                timeout: 3000,
            });
            const companies = Array.isArray(response.data) ? response.data : [];
            return companies
                .filter((c) => c && typeof c.id === "number" && typeof c.company_name === "string")
                .map((c) => ({
                id: c.id,
                company_name: c.company_name,
            }));
        }
        catch (error) {
            console.warn(`⚠️ [LocationsService] Nu am putut obține numele companiilor pentru IDs ${companyIds.join(", ")} de la ${companiesUrl}/companies/batch: ${error.message}`);
            return [];
        }
    }
    async findWorkLocationById(id, user) {
        const workLocation = await this.workLocationRepository.findOne({
            where: { id },
            relations: ["task_templates"],
        });
        if (!workLocation)
            throw new common_1.NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
        let companyName;
        if (workLocation.company_id) {
            try {
                const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://giurom.bitap.ro:3003";
                const response = await axios_1.default.get(`${companiesUrl}/companies/${workLocation.company_id}`, {
                    headers: {
                        "x-internal-service": "locations",
                        "x-service-secret": process.env.SERVICE_SECRET || "default-service-secret",
                    },
                    timeout: 2000,
                });
                companyName = response.data?.company_name || response.data?.name;
            }
            catch {
            }
        }
        const locationWithCompany = {
            ...workLocation,
            company_name: companyName,
        };
        const hasLocationReadPermission = user?.permissions?.includes("locations.read");
        if (!hasLocationReadPermission && user) {
            const employeeId = user.id || user.employee_id || user.userId;
            const userWorkLocationId = user.work_location_id;
            if (userWorkLocationId && userWorkLocationId === id) {
                return locationWithCompany;
            }
            if (employeeId) {
                try {
                    const employeesUrl = process.env.EMPLOYEES_HTTP_URL || "http://giurom.bitap.ro:3001";
                    const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                        headers: {
                            "x-internal-service": "locations",
                            "x-service-secret": process.env.SERVICE_SECRET || "default-service-secret",
                            "Content-Type": "application/json",
                        },
                        timeout: 3000,
                    });
                    const employeeLocations = Array.isArray(response.data)
                        ? response.data
                        : [];
                    const hasAccess = employeeLocations.some((el) => {
                        const elLocationId = el.idLocation ||
                            el.id_location ||
                            el.locationId ||
                            el.location_id;
                        return elLocationId === id || String(elLocationId) === String(id);
                    });
                    if (hasAccess) {
                        return locationWithCompany;
                    }
                }
                catch (error) {
                    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
                        try {
                            const workLocationId = user.work_location_id || user.work_location_default_id;
                            if (workLocationId && workLocationId === id) {
                                return locationWithCompany;
                            }
                            const employeesDbName = process.env.EMPLOYEES_DB_NAME || "giurombitap_employees";
                            const dbResult = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ? AND id_location = ?`, [employeeId, id]);
                            if (dbResult && dbResult.length > 0) {
                                console.log(`✅ Found location ${id} in employees_locations via direct DB query for employee ${employeeId}`);
                                return locationWithCompany;
                            }
                            throw new common_1.ForbiddenException("Nu ai acces la această locație");
                        }
                        catch (dbError) {
                            console.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
                            const workLocationId = user.work_location_id || user.work_location_default_id;
                            if (workLocationId && workLocationId === id) {
                                return locationWithCompany;
                            }
                            throw new common_1.ForbiddenException("Nu ai acces la această locație");
                        }
                    }
                }
            }
            throw new common_1.ForbiddenException("Nu ai acces la această locație");
        }
        return locationWithCompany;
    }
    async findWorkLocationsByCompany(companyId) {
        return await this.workLocationRepository.find({
            where: { company_id: companyId },
            relations: ["task_templates"],
            order: { id: "DESC" },
        });
    }
    async updateWorkLocation(id, dto) {
        const workLocation = await this.findWorkLocationById(id);
        const oldName = workLocation.location_name;
        Object.assign(workLocation, dto);
        const updatedLocation = await this.workLocationRepository.save(workLocation);
        await this.sendLocationNotification("location_updated", "Locatie modificata", `Locatia ${oldName} a fost modificata`, updatedLocation.id, {
            oldName,
            newName: updatedLocation.location_name,
            updatedFields: Object.keys(dto),
        }, `/locatii/${updatedLocation.id}`);
        return updatedLocation;
    }
    async removeWorkLocation(id) {
        const workLocation = await this.findWorkLocationById(id);
        const locationName = workLocation.location_name;
        const departmentsCount = await this.departmentsRepository.count({
            where: { work_location_id: id },
        });
        const revenuePointsCount = await this.revenuePointsRepository.count({
            where: { work_location_id: id },
        });
        await this.sendLocationNotification("location_deleted", "Locatie stearsa", `Locatia ${locationName} a fost stearsa (Departamente: ${departmentsCount}, Puncte: ${revenuePointsCount}, Angajati afectati)`, id, {
            locationName,
            departmentsCount,
            revenuePointsCount,
        }, `/locatii/${id}`);
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
            .createQueryBuilder("assignment")
            .leftJoinAndSelect("assignment.work_location", "work_location");
        if (locationId)
            qb.where("assignment.location_id = :locationId", { locationId });
        if (templateId)
            qb.andWhere("assignment.template_id = :templateId", { templateId });
        if (active !== undefined)
            qb.andWhere("assignment.active = :active", { active });
        const offset = (page - 1) * limit;
        const [assignments, total] = await qb
            .orderBy("assignment.assigned_at", "DESC")
            .skip(offset)
            .take(limit)
            .getManyAndCount();
        return { assignments, total, totalPages: Math.ceil(total / limit) };
    }
    async findTaskTemplateAssignmentById(id) {
        const assignment = await this.taskTemplateRepository.findOne({
            where: { id },
            relations: ["work_location"],
        });
        if (!assignment)
            throw new common_1.NotFoundException(`Atribuirea cu ID-ul ${id} nu a fost găsită`);
        return assignment;
    }
    async findTaskTemplateAssignmentsByLocation(locationId) {
        await this.findWorkLocationById(locationId);
        return await this.taskTemplateRepository.find({
            where: { location_id: locationId },
            relations: ["work_location"],
            order: { assigned_at: "DESC" },
        });
    }
    async findDepartmentsByLocation(locationId) {
        return this.departmentsRepository.find({
            where: { work_location_id: locationId },
            order: { name: "ASC" },
        });
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
        return this.positionsRepository.find({
            where: { department_id: departmentId },
            order: { name: "ASC" },
        });
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
        await this.revenuePointsRepository.delete({
            work_location_id: workLocationId,
        });
        const rows = intervals.map((i) => ({
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
            order: { min_revenue: "ASC" },
        });
    }
    async setManagerPercent(workLocationId, managerPercent, _fallbackRevenuePerPoint) {
        let cfg = await this.managerConfigRepository.findOne({
            where: { work_location_id: workLocationId },
        });
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
        return this.managerConfigRepository.findOne({
            where: { work_location_id: workLocationId },
        });
    }
    async recordRevenue(workLocationId, revenueDate, onlineAmount, cashAmount, cardAmount, totalAmount, status, imageUrl, userId) {
        await this.findWorkLocationById(workLocationId);
        if (!userId || userId === 0 || isNaN(Number(userId))) {
            console.error("❌ [recordRevenue Service] Invalid employee_id:", userId);
            throw new Error("Employee ID is required and must be a valid number");
        }
        const employeeId = Number(userId);
        console.log("🔍 [recordRevenue Service] Saving revenue with:", {
            workLocationId,
            revenueDate,
            employeeId,
            userId: employeeId,
        });
        const normalizedDate = revenueDate
            ? revenueDate.toString().trim().split(" ")[0].split("T")[0]
            : null;
        if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            throw new Error("revenue_date trebuie să fie în format YYYY-MM-DD sau YYYY-MM-DD HH:mm:ss");
        }
        const revenueDateToStore = `${normalizedDate} 12:00:00`;
        const existing = await this.revenueRepository.findOne({
            where: {
                work_location_id: workLocationId,
                revenue_date: (0, typeorm_2.Like)(`${normalizedDate}%`),
            },
        });
        if (existing) {
            console.error(`❌ [recordRevenue Service] Duplicate revenue for date ${normalizedDate} at location ${workLocationId}`);
            throw new common_1.ConflictException(`Există deja o încasare pentru data ${normalizedDate}`);
        }
        const row = this.revenueRepository.create({
            work_location_id: workLocationId,
            revenue_date: revenueDateToStore,
            online_amount: onlineAmount,
            cash_amount: cashAmount,
            card_amount: cardAmount,
            total_amount: totalAmount,
            status: status,
            image_url: imageUrl,
            employee_id: employeeId,
        });
        const saved = await this.revenueRepository.save(row);
        console.log("✅ [recordRevenue Service] Revenue saved successfully with employee_id:", saved.employee_id);
        return saved;
    }
    async listRevenue(workLocationId, opts) {
        await this.findWorkLocationById(workLocationId);
        const page = Math.max(1, Number(opts?.page || 1));
        const limit = Math.max(1, Math.min(200, Number(opts?.limit || 50)));
        const qb = this.revenueRepository
            .createQueryBuilder("rev")
            .where("rev.work_location_id = :workLocationId", { workLocationId })
            .orderBy("rev.revenue_date", "DESC");
        if (opts?.startDate)
            qb.andWhere("rev.revenue_date >= :startDate", {
                startDate: opts.startDate,
            });
        if (opts?.endDate)
            qb.andWhere("rev.revenue_date <= :endDate", { endDate: opts.endDate });
        const offset = (page - 1) * limit;
        const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
        const authDbName = process.env.AUTH_DB_NAME || "giurombitap_auth";
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || "giurombitap_employees";
        const revenuesWithEmployeeId = await Promise.all(items.map(async (rev) => {
            if (!rev.employee_id) {
                return {
                    ...rev,
                    employee_id: null,
                    employee_first_name: null,
                    employee_last_name: null,
                };
            }
            try {
                const employeeResult = await this.dataSource.query(`SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`, [rev.employee_id]);
                if (employeeResult && employeeResult.length > 0) {
                    return {
                        ...rev,
                        employee_id: Number(rev.employee_id),
                        employee_first_name: employeeResult[0].first_name || null,
                        employee_last_name: employeeResult[0].last_name || null,
                    };
                }
                return {
                    ...rev,
                    employee_id: Number(rev.employee_id),
                    employee_first_name: null,
                    employee_last_name: null,
                };
            }
            catch (error) {
                console.error(`❌ Error fetching employee data for employee_id ${rev.employee_id}:`, error.message);
                return {
                    ...rev,
                    employee_id: Number(rev.employee_id),
                    employee_first_name: null,
                    employee_last_name: null,
                };
            }
        }));
        return {
            revenues: revenuesWithEmployeeId,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }
    async deleteRevenue(revenueId) {
        const revenue = await this.revenueRepository.findOne({
            where: { id: revenueId },
        });
        if (!revenue)
            throw new common_1.NotFoundException(`Încasarea cu ID-ul ${revenueId} nu a fost găsită`);
        await this.revenueRepository.remove(revenue);
    }
    async updateRevenue(revenueId, data) {
        const revenue = await this.revenueRepository.findOne({
            where: { id: revenueId },
        });
        if (!revenue)
            throw new common_1.NotFoundException(`Încasarea cu ID-ul ${revenueId} nu a fost găsită`);
        const wasApproved = revenue.status === work_location_revenue_entity_1.RevenueStatus.Approved;
        const becomingApproved = data.status === work_location_revenue_entity_1.RevenueStatus.Approved;
        const shouldCalculateBonuses = becomingApproved && !wasApproved;
        const revenueDateRaw = data.revenue_date || revenue.revenue_date;
        const revenueDate = revenueDateRaw
            ? revenueDateRaw.toString().split(" ")[0].split("T")[0]
            : null;
        if (data.revenue_date) {
            const dateStr = data.revenue_date.toString();
            let datePart;
            if (dateStr.includes("T")) {
                datePart = dateStr.split("T")[0];
            }
            else if (dateStr.includes(" ")) {
                datePart = dateStr.split(" ")[0];
            }
            else {
                datePart = dateStr;
            }
            if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
                revenue.revenue_date = `${datePart} 12:00:00`;
            }
            else {
                revenue.revenue_date = data.revenue_date;
            }
        }
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
            this.calculateEmployeeBonusesForDate(revenue.work_location_id, revenueDate).catch((err) => {
                console.error(`❌ [BONUS TRIGGER] Error calculating bonuses for revenue ${revenueId}:`, err);
            });
        }
        return savedRevenue;
    }
    async calculateEmployeeBonusesForDate(locationId, revenueDate) {
        try {
            const normalizedDate = revenueDate.toString().split(" ")[0].split("T")[0];
            console.log(`🔍 [BONUS CALC] Starting bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`);
            const approvedRevenues = await this.revenueRepository
                .createQueryBuilder("revenue")
                .where("revenue.work_location_id = :locationId", { locationId })
                .andWhere("DATE(revenue.revenue_date) = :revenueDate", {
                revenueDate: normalizedDate,
            })
                .andWhere("revenue.status = :status", {
                status: work_location_revenue_entity_1.RevenueStatus.Approved,
            })
                .getMany();
            if (!approvedRevenues || approvedRevenues.length === 0) {
                console.log(`⚠️ [BONUS CALC] No approved revenues found for location ${locationId}, date ${revenueDate}`);
                return;
            }
            const intervals = await this.revenuePointsRepository.find({
                where: { work_location_id: locationId },
                order: { min_revenue: "ASC" },
            });
            const managerCfg = await this.managerConfigRepository.findOne({
                where: { work_location_id: locationId },
            });
            const fallback = 0;
            const employeesUrl = process.env.EMPLOYEES_HTTP_URL || "http://giurom.bitap.ro:3001";
            let employees = [];
            try {
                const response = await axios_1.default.get(`${employeesUrl}/locations/${locationId}/employees`, {
                    headers: { "Content-Type": "application/json" },
                });
                employees = Array.isArray(response.data)
                    ? response.data
                    : Array.isArray(response.data?.data)
                        ? response.data.data
                        : [];
                console.log(`👥 [BONUS CALC] Found ${employees.length} employees in location ${locationId}`);
            }
            catch (error) {
                console.error(`❌ [BONUS CALC] Failed to fetch employees for location ${locationId}:`, error);
                return;
            }
            const pickMultiplier = (totalAmount) => {
                for (const intv of intervals) {
                    const minOk = totalAmount >= Number(intv.min_revenue);
                    const maxOk = intv.max_revenue == null
                        ? true
                        : totalAmount <= Number(intv.max_revenue);
                    if (minOk && maxOk) {
                        return Number(intv.points);
                    }
                }
                return fallback;
            };
            const tasksApiUrl = process.env.TASKS_API_BASE || "http://giurom.bitap.ro:3008";
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
                            headers: { "Content-Type": "application/json" },
                        });
                        const pointsData = pointsResponse.data;
                        employeePoints = Number(pointsData?.total_points || pointsData?.data?.total_points || 0);
                    }
                    catch (error) {
                        console.log(`⚠️ [BONUS CALC] Could not fetch points for employee ${employeeId}, revenue_date: ${normalizedDate}`);
                        try {
                            const rangeUrl = `${tasksApiUrl}/executions/employee-points/${employeeId}?startDate=${normalizedDate}&endDate=${normalizedDate}`;
                            const rangeResponse = await axios_1.default.get(rangeUrl, {
                                headers: { "Content-Type": "application/json" },
                            });
                            const rangeData = Array.isArray(rangeResponse.data)
                                ? rangeResponse.data
                                : Array.isArray(rangeResponse.data?.data)
                                    ? rangeResponse.data.data
                                    : [];
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
        const cfg = await this.managerConfigRepository.findOne({
            where: { work_location_id: workLocationId },
        });
        if (!cfg)
            return {
                totalPoints: 0,
                managerPoints: 0,
                managerPercent: 0,
                breakdown: [],
            };
        const revs = await this.revenueRepository.find({
            where: {
                work_location_id: workLocationId,
                revenue_date: revenueDate,
            },
        });
        if (!revs || revs.length === 0)
            return {
                totalPoints: 0,
                managerPoints: 0,
                managerPercent: Number(cfg.manager_percent),
                breakdown: [],
            };
        const intervals = await this.revenuePointsRepository.find({
            where: { work_location_id: workLocationId },
            order: { min_revenue: "ASC" },
        });
        let totalPoints = 0;
        let totalManagerPoints = 0;
        const breakdown = [];
        for (const rev of revs) {
            let pointsPerUnit = null;
            let matched = null;
            for (const intv of intervals) {
                const minOk = Number(rev.total_amount) >= Number(intv.min_revenue);
                const maxOk = intv.max_revenue == null
                    ? true
                    : Number(rev.total_amount) <= Number(intv.max_revenue);
                if (minOk && maxOk) {
                    pointsPerUnit = Number(intv.points);
                    matched = {
                        min: Number(intv.min_revenue),
                        max: intv.max_revenue == null ? null : Number(intv.max_revenue),
                    };
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
            breakdown.push({
                amount,
                pointsPerUnit,
                interval: matched,
                points: pts,
                managerShare: managerPts,
            });
        }
        return {
            totalPoints,
            managerPoints: totalManagerPoints,
            managerPercent: Number(cfg.manager_percent),
            breakdown,
        };
    }
    async createFile(createFileDto) {
        console.log("📥 Received createFileDto:", {
            work_location_id: createFileDto.work_location_id,
            file_name: createFileDto.file_name,
            file_type: createFileDto.file_type,
            has_content: !!createFileDto.file_content,
            content_length: createFileDto.file_content?.length || 0,
        });
        const location = await this.workLocationRepository.findOne({
            where: { id: createFileDto.work_location_id },
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${createFileDto.work_location_id} nu a fost găsită`);
        }
        let companyName = "Unknown";
        try {
            const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
            const serviceSecret = process.env.SERVICE_SECRET || "default-service-secret";
            const response = await axios_1.default.get(`${companiesUrl}/companies/${location.company_id}`, {
                headers: {
                    "x-internal-service": "locations",
                    "x-service-secret": serviceSecret,
                    "Content-Type": "application/json",
                },
                timeout: 3000,
            });
            if (response.data && response.data.company_name) {
                companyName = response.data.company_name;
            }
        }
        catch (error) {
            console.warn(`⚠️ Could not fetch company name for company ID ${location.company_id}:`, error.message);
        }
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, -5);
        const fileExtension = createFileDto.file_name.split(".").pop() || "txt";
        const baseFileName = createFileDto.file_name.replace(/\.[^/.]+$/, "") || "file";
        const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;
        let fileDir;
        let updatedFileLink;
        const folderIdToSave = createFileDto.folder_id ?? null;
        if (createFileDto.folder_id) {
            const folder = await this.folderRepository.findOne({
                where: { id: createFileDto.folder_id, work_location_id: location.id },
            });
            if (!folder) {
                throw new common_1.NotFoundException(`Folderul cu ID-ul ${createFileDto.folder_id} nu a fost găsit pentru această locație`);
            }
            const basePath = this.getLocationBasePath(companyName, location.location_name);
            fileDir = path.join(basePath, folder.folder_path);
            const relativePath = folder.folder_path.replace(/\\/g, "/");
            updatedFileLink = `/files/companies/${companyName}/Locații/${location.location_name}/${relativePath}/${uniqueFileName}`.replace(/\/+/g, "/");
        }
        else {
            let folderName = null;
            if (createFileDto.notes) {
                const folderMatch = createFileDto.notes.match(/\|folder:([^|]+)\|/);
                if (folderMatch?.[1])
                    folderName = folderMatch[1];
            }
            const companyFilesRootDir = this.getFilesCompaniesRoot();
            const companyDir = path.join(companyFilesRootDir, companyName);
            const locationsDir = path.join(companyDir, "Locații");
            const locationDir = path.join(locationsDir, location.location_name);
            if (folderName) {
                fileDir = path.join(locationDir, folderName);
            }
            else {
                fileDir = locationDir;
            }
            updatedFileLink = `/files/companies/${companyName}/Locații/${location.location_name}${folderName ? `/${folderName}` : ""}/${uniqueFileName}`.replace(/\/+/g, "/");
        }
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        if (createFileDto.file_content) {
            try {
                const filePath = path.join(fileDir, uniqueFileName);
                let base64Data = createFileDto.file_content;
                if (base64Data.includes(",")) {
                    base64Data = base64Data.split(",")[1];
                }
                console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
                const buffer = Buffer.from(base64Data, "base64");
                fs.writeFileSync(filePath, buffer);
                console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
            }
            catch (error) {
                console.error("❌ Error saving file to disk:", error);
            }
        }
        const existingFile = await this.filesRepository.findOne({
            where: {
                work_location_id: createFileDto.work_location_id,
                file_name: uniqueFileName,
            },
        });
        if (existingFile) {
            throw new common_1.ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru această locație`);
        }
        const file = this.filesRepository.create({
            ...createFileDto,
            file_name: uniqueFileName,
            file_link: updatedFileLink,
            folder_id: folderIdToSave,
            expire_date: createFileDto.expire_date
                ? new Date(createFileDto.expire_date)
                : null,
        });
        const savedFile = await this.filesRepository.save(file);
        console.log(`✅ File record saved to database with ID: ${savedFile.id}`);
        return savedFile;
    }
    async findOneFile(id) {
        const file = await this.filesRepository.findOne({
            where: { id },
            relations: ["workLocation"],
        });
        if (!file) {
            throw new common_1.NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
        }
        return file;
    }
    async findFilesByLocation(work_location_id) {
        const location = await this.workLocationRepository.findOne({
            where: { id: work_location_id },
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${work_location_id} nu a fost găsită`);
        }
        return await this.filesRepository.find({
            where: { work_location_id },
            relations: ["workLocation"],
            order: { updated_at: "DESC" },
        });
    }
    async findFoldersByLocation(work_location_id) {
        const location = await this.workLocationRepository.findOne({
            where: { id: work_location_id },
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${work_location_id} nu a fost găsită`);
        }
        return this.folderRepository.find({
            where: { work_location_id },
            order: { description: "ASC" },
        });
    }
    async createFolder(locationId, body) {
        const location = await this.workLocationRepository.findOne({
            where: { id: locationId },
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${locationId} nu a fost găsită`);
        }
        const companyName = await this.getCompanyNameForLocation(location);
        const basePath = this.getLocationBasePath(companyName, location.location_name);
        const parentId = body.parent_id ?? null;
        let folderPath;
        if (parentId) {
            const parent = await this.folderRepository.findOne({
                where: { id: parentId, work_location_id: locationId },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Folderul părinte cu ID-ul ${parentId} nu a fost găsit`);
            }
            folderPath = path.join(parent.folder_path, body.description);
        }
        else {
            folderPath = body.description;
        }
        const existing = await this.folderRepository.findOne({
            where: {
                work_location_id: locationId,
                parent_id: parentId,
                description: body.description,
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Un folder cu numele "${body.description}" există deja în același loc`);
        }
        const absoluteDir = path.join(basePath, folderPath);
        if (!fs.existsSync(absoluteDir)) {
            fs.mkdirSync(absoluteDir, { recursive: true });
        }
        const folder = this.folderRepository.create({
            work_location_id: locationId,
            description: body.description,
            folder_path: folderPath.replace(/\\/g, "/"),
            parent_id: parentId,
        });
        return this.folderRepository.save(folder);
    }
    async updateFolder(locationId, folderId, body) {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId, work_location_id: locationId },
        });
        if (!folder) {
            throw new common_1.NotFoundException(`Folderul cu ID-ul ${folderId} nu a fost găsit`);
        }
        const location = await this.workLocationRepository.findOne({
            where: { id: locationId },
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${locationId} nu a fost găsită`);
        }
        const existingSibling = await this.folderRepository.findOne({
            where: {
                work_location_id: locationId,
                parent_id: folder.parent_id,
                description: body.description,
            },
        });
        if (existingSibling && existingSibling.id !== folderId) {
            throw new common_1.ConflictException(`Un folder cu numele "${body.description}" există deja în același loc`);
        }
        const companyName = await this.getCompanyNameForLocation(location);
        const basePath = this.getLocationBasePath(companyName, location.location_name);
        const oldAbsolute = path.join(basePath, folder.folder_path);
        const parent = folder.parent_id
            ? await this.folderRepository.findOne({ where: { id: folder.parent_id } })
            : null;
        const newFolderPath = parent
            ? (parent.folder_path + "/" + body.description).replace(/\/+/g, "/")
            : body.description;
        const newAbsolute = path.join(basePath, newFolderPath);
        if (oldAbsolute !== newAbsolute && fs.existsSync(oldAbsolute)) {
            fs.renameSync(oldAbsolute, newAbsolute);
        }
        const oldFolderPath = folder.folder_path;
        folder.description = body.description;
        folder.folder_path = newFolderPath;
        await this.folderRepository.save(folder);
        const prefix = oldFolderPath + "/";
        const children = await this.folderRepository.find({
            where: { work_location_id: locationId },
        });
        for (const c of children) {
            if (c.folder_path.startsWith(prefix) && c.id !== folder.id) {
                c.folder_path = newFolderPath + c.folder_path.slice(oldFolderPath.length);
                await this.folderRepository.save(c);
            }
        }
        return this.folderRepository.findOne({ where: { id: folderId } });
    }
    async removeFolder(locationId, folderId) {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId, work_location_id: locationId },
        });
        if (!folder) {
            throw new common_1.NotFoundException(`Folderul cu ID-ul ${folderId} nu a fost găsit`);
        }
        const location = await this.workLocationRepository.findOne({
            where: { id: locationId },
        });
        if (!location) {
            throw new common_1.NotFoundException(`Locația cu ID-ul ${locationId} nu a fost găsită`);
        }
        const companyName = await this.getCompanyNameForLocation(location);
        const basePath = this.getLocationBasePath(companyName, location.location_name);
        const absoluteDir = path.join(basePath, folder.folder_path);
        const allFolders = await this.folderRepository.find({
            where: { work_location_id: locationId },
        });
        const toDelete = allFolders.filter((f) => f.folder_path === folder.folder_path || f.folder_path.startsWith(folder.folder_path + "/"));
        const idsToDelete = toDelete.map((f) => f.id);
        await this.filesRepository.update({ folder_id: (0, typeorm_2.In)(idsToDelete) }, { folder_id: null });
        await this.folderRepository.delete(idsToDelete);
        const removeDirRecursive = (dir) => {
            if (!fs.existsSync(dir))
                return;
            for (const name of fs.readdirSync(dir)) {
                const full = path.join(dir, name);
                if (fs.statSync(full).isDirectory()) {
                    removeDirRecursive(full);
                }
                else {
                    fs.unlinkSync(full);
                }
            }
            fs.rmdirSync(dir);
        };
        if (fs.existsSync(absoluteDir)) {
            removeDirRecursive(absoluteDir);
        }
    }
    async serveFile(file_id, forceDownload = false) {
        try {
            console.log(`🔍 [serveFile] Starting to serve file with ID: ${file_id}, forceDownload: ${forceDownload}`);
            const file = await this.findOneFile(file_id);
            console.log(`📄 [serveFile] File metadata retrieved:`, {
                id: file.id,
                name: file.file_name,
                work_location_id: file.work_location_id,
                file_link: file.file_link,
            });
            const location = await this.workLocationRepository.findOne({
                where: { id: file.work_location_id },
            });
            if (!location) {
                throw new common_1.NotFoundException(`Locația cu ID-ul ${file.work_location_id} nu a fost găsită`);
            }
            let filePath;
            if (file.file_link.startsWith("/files/companies/")) {
                const relative = file.file_link.replace(/^\/files\/companies\//, "").replace(/\//g, path.sep);
                filePath = path.join(this.getFilesCompaniesRoot(), relative);
            }
            else {
                let companyName = "Unknown";
                try {
                    const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
                    const serviceSecret = process.env.SERVICE_SECRET || "default-service-secret";
                    const response = await axios_1.default.get(`${companiesUrl}/companies/${location.company_id}`, {
                        headers: {
                            "x-internal-service": "locations",
                            "x-service-secret": serviceSecret,
                            "Content-Type": "application/json",
                        },
                        timeout: 3000,
                    });
                    if (response.data?.company_name)
                        companyName = response.data.company_name;
                }
                catch (err) {
                    console.warn(`⚠️ Could not fetch company name:`, err?.message);
                }
                const locationDir = path.join(this.getFilesCompaniesRoot(), companyName, "Locații", location.location_name);
                let folderName = null;
                if (file.notes) {
                    const m = file.notes.match(/\|folder:([^|]+)\|/);
                    if (m?.[1])
                        folderName = m[1];
                }
                filePath = folderName
                    ? path.join(locationDir, folderName, file.file_name)
                    : path.join(locationDir, file.file_name);
            }
            console.log(`📁 [serveFile] Full file path: ${filePath}`);
            console.log(`📁 [serveFile] Path exists check: ${fs.existsSync(filePath)}`);
            if (!fs.existsSync(filePath)) {
                console.error(`❌ [serveFile] File not found on disk: ${filePath}`);
                throw new common_1.NotFoundException("Fișierul nu a fost găsit pe disk");
            }
            const mimeType = this.getMimeType(file.file_name);
            console.log(`📋 [serveFile] MIME type determined: ${mimeType}`);
            const fileBuffer = fs.readFileSync(filePath);
            console.log(`✅ [serveFile] File read successfully: ${file.file_name} (${fileBuffer.length} bytes)`);
            return {
                data: fileBuffer.toString("base64"),
                mimeType,
                fileName: file.file_name,
                disposition: forceDownload ? "attachment" : "inline",
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
        const extension = fileName.split(".").pop()?.toLowerCase();
        const mimeTypes = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            txt: "text/plain",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            xls: "application/vnd.ms-excel",
        };
        return mimeTypes[extension || ""] || "application/octet-stream";
    }
    async removeFile(id) {
        const file = await this.findOneFile(id);
        try {
            const location = await this.workLocationRepository.findOne({
                where: { id: file.work_location_id },
            });
            if (location) {
                let companyName = "Unknown";
                try {
                    const companiesUrl = process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
                    const serviceSecret = process.env.SERVICE_SECRET || "default-service-secret";
                    const response = await axios_1.default.get(`${companiesUrl}/companies/${location.company_id}`, {
                        headers: {
                            "x-internal-service": "locations",
                            "x-service-secret": serviceSecret,
                            "Content-Type": "application/json",
                        },
                        timeout: 3000,
                    });
                    if (response.data && response.data.company_name) {
                        companyName = response.data.company_name;
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Could not fetch company name for company ID ${location.company_id}:`, error.message);
                }
                const companyFilesRootDir = path.resolve(__dirname, "../../../..");
                const companyFilesDir = path.join(companyFilesRootDir, "files", "companies");
                const companyDir = path.join(companyFilesDir, companyName);
                const locationsDir = path.join(companyDir, "Locații");
                const locationDir = path.join(locationsDir, location.location_name);
                let folderName = null;
                if (file.notes) {
                    const folderMatch = file.notes.match(/\|folder:([^|]+)\|/);
                    if (folderMatch && folderMatch[1]) {
                        folderName = folderMatch[1];
                    }
                }
                let filePath;
                if (folderName) {
                    const locatiiSubfolderDir = path.join(locationDir, "Locații");
                    const designatedFolderDir = path.join(locatiiSubfolderDir, folderName);
                    filePath = path.join(designatedFolderDir, file.file_name);
                }
                else {
                    filePath = path.join(locationDir, file.file_name);
                }
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`✅ Deleted physical file: ${filePath}`);
                }
                else {
                    console.warn(`⚠️ Physical file not found for removal: ${filePath}`);
                }
            }
        }
        catch (error) {
            console.warn(`⚠️ Failed to delete physical file for file ${id}:`, error);
        }
        await this.filesRepository.delete(id);
        return {
            message: `Fișierul "${file.file_name}" al locației ${file.workLocation?.location_name || "Unknown"} a fost șters cu succes`,
        };
    }
    async findExpiringFiles(targetDate) {
        console.log(`[LOCATIONS SERVICE] Finding files expiring on ${targetDate}`);
        const formattedDate = new Date(targetDate);
        formattedDate.setHours(0, 0, 0, 0);
        const files = await this.filesRepository
            .createQueryBuilder("file")
            .where("DATE(file.expire_date) = :targetDate", { targetDate })
            .leftJoinAndSelect("file.workLocation", "location")
            .getMany();
        console.log(`[LOCATIONS SERVICE] Found ${files.length} files expiring on ${targetDate}`);
        return files;
    }
    async findExpiredFiles() {
        console.log(`[LOCATIONS SERVICE] Finding expired files`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const files = await this.filesRepository
            .createQueryBuilder("file")
            .where("file.expire_date < :today", { today })
            .andWhere("file.expire_date IS NOT NULL")
            .leftJoinAndSelect("file.workLocation", "location")
            .getMany();
        console.log(`[LOCATIONS SERVICE] Found ${files.length} expired files`);
        return files;
    }
    async uploadCashingImage(fileName, base64Content) {
        try {
            let base64Data = base64Content;
            if (base64Data.includes(",")) {
                base64Data = base64Data.split(",")[1];
            }
            const timestamp = Date.now();
            const fileExtension = fileName.split(".").pop() || "jpg";
            const baseFileName = fileName.replace(/\.[^/.]+$/, "") || "image";
            const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;
            const repoRoot = this.getRepoRoot();
            const imagesDir = path.join(repoRoot, "images");
            const cashingDir = path.join(imagesDir, "cashing");
            if (!fs.existsSync(cashingDir)) {
                fs.mkdirSync(cashingDir, { recursive: true });
                console.log(`📁 Created images/cashing directory: ${cashingDir}`);
                console.log(`📁 Repo root: ${repoRoot}`);
                console.log(`📁 Images dir: ${imagesDir}`);
            }
            const filePath = path.join(cashingDir, uniqueFileName);
            const buffer = Buffer.from(base64Data, "base64");
            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Cashing image saved: ${filePath} (${buffer.length} bytes)`);
            console.log(`✅ File exists check: ${fs.existsSync(filePath)}`);
            return `/api/images/cashing/${uniqueFileName}`;
        }
        catch (error) {
            console.error(`❌ Error uploading cashing image: ${error}`);
            throw new common_1.BadRequestException(`Eroare la salvarea imaginii: ${error?.message || "Unknown error"}`);
        }
    }
    async serveCashingImage(fileName) {
        try {
            const repoRoot = this.getRepoRoot();
            const imagesDir = path.join(repoRoot, "images", "cashing");
            const filePath = path.join(imagesDir, fileName);
            if (!fs.existsSync(filePath)) {
                throw new common_1.NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
            }
            const buffer = fs.readFileSync(filePath);
            const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
            let mimeType = "image/jpeg";
            switch (extension) {
                case "png":
                    mimeType = "image/png";
                    break;
                case "gif":
                    mimeType = "image/gif";
                    break;
                case "webp":
                    mimeType = "image/webp";
                    break;
                case "svg":
                    mimeType = "image/svg+xml";
                    break;
                case "jfif":
                    mimeType = "image/jpeg";
                    break;
            }
            return { buffer, mimeType };
        }
        catch (error) {
            console.error(`❌ Error serving cashing image: ${error}`);
            throw error;
        }
    }
    async deleteCashingImage(imageUrl) {
        try {
            const urlParts = imageUrl.split("/");
            const fileName = urlParts[urlParts.length - 1];
            if (!fileName) {
                throw new common_1.BadRequestException("URL-ul imaginii nu este valid");
            }
            const repoRoot = this.getRepoRoot();
            const imagesDir = path.join(repoRoot, "images", "cashing");
            const filePath = path.join(imagesDir, fileName);
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Cashing image not found for deletion: ${filePath}`);
                return;
            }
            fs.unlinkSync(filePath);
            console.log(`✅ Cashing image deleted: ${filePath}`);
        }
        catch (error) {
            console.error(`❌ Error deleting cashing image: ${error}`);
            throw new common_1.BadRequestException(`Eroare la ștergerea imaginii: ${error?.message || "Unknown error"}`);
        }
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
    __param(8, (0, typeorm_1.InjectRepository)(work_location_folder_entity_1.WorkLocationFolder)),
    __param(9, (0, common_1.Inject)("NOTIFICATIONS_RMQ")),
    __param(10, (0, common_1.Inject)(typeorm_2.DataSource)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
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
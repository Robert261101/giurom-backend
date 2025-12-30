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
exports.RecipesLabelsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const microservices_1 = require("@nestjs/microservices");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const recipe_label_entity_1 = require("./entities/recipe-label.entity");
const recipe_preparation_entity_1 = require("./entities/recipe-preparation.entity");
let RecipesLabelsService = class RecipesLabelsService {
    constructor(labelRepo, prepRepo, rmq, httpService, configService) {
        this.labelRepo = labelRepo;
        this.prepRepo = prepRepo;
        this.rmq = rmq;
        this.httpService = httpService;
        this.configService = configService;
        let employeesServiceUrl = this.configService.get('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
        if (employeesServiceUrl.includes('bitap.ro') || employeesServiceUrl.includes('89.46.6.45')) {
            const portMatch = employeesServiceUrl.match(/:(\d+)/);
            const port = portMatch ? portMatch[1] : '3012';
            employeesServiceUrl = `http://localhost:${port}`;
        }
        this.employeesServiceUrl = employeesServiceUrl;
    }
    async findAll() {
        const labels = await this.labelRepo.find({
            order: { generated_at: 'DESC' },
            relations: ['preparation', 'preparation.recipe']
        });
        const employeeIds = labels
            .map(label => label.generated_by_employee_id)
            .filter((id) => id !== null && id !== undefined);
        const employeesMap = new Map();
        if (employeeIds.length > 0 && this.httpService) {
            const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
            const headers = {
                'Content-Type': 'application/json',
                'x-internal-service': 'recipes',
                'x-service-secret': serviceSecret
            };
            for (const employeeId of employeeIds) {
                try {
                    const employeeResponse = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.employeesServiceUrl}/employees/${employeeId}`, { headers }));
                    const employeeData = employeeResponse?.data?.data || employeeResponse?.data || employeeResponse;
                    if (employeeData) {
                        employeesMap.set(employeeId, employeeData);
                    }
                }
                catch (error) {
                    if (error?.response?.status !== 404) {
                        console.warn(`⚠️ [RECIPES LABELS SERVICE] Could not fetch employee ${employeeId}:`, error?.message);
                    }
                }
            }
        }
        return labels.map(label => {
            const labelAny = label;
            if (label.generated_by_employee_id && employeesMap.has(label.generated_by_employee_id)) {
                const employee = employeesMap.get(label.generated_by_employee_id);
                labelAny.generated_by_name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
                    || employee.email
                    || `Angajat ID: ${label.generated_by_employee_id}`;
            }
            return labelAny;
        });
    }
    async findOne(id) {
        const label = await this.labelRepo.findOne({ where: { id } });
        if (!label)
            throw new common_1.NotFoundException('Label not found');
        return label;
    }
    async generateCode(user) {
        const firstName = user?.first_name || user?.firstName || 'usr';
        const initials = firstName
            .toLowerCase()
            .replace(/[^a-zăâîșț]/g, '')
            .substring(0, 3)
            .padEnd(3, 'x');
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const dateStr = `${day}${month}${year}`;
        const baseCode = `${initials}${dateStr}`;
        const existingLabels = await this.labelRepo
            .createQueryBuilder('label')
            .where('label.label_code LIKE :pattern', { pattern: `${baseCode}%` })
            .getMany();
        const existingNumbers = existingLabels
            .map(label => {
            const match = label.label_code.match(new RegExp(`^${baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
            return match ? parseInt(match[1], 10) : 0;
        })
            .filter(num => num > 0);
        const nextNumber = existingNumbers.length > 0
            ? Math.max(...existingNumbers) + 1
            : 1;
        return `${baseCode}${nextNumber}`;
    }
    async create(dto, user) {
        const prep = await this.prepRepo.findOne({ where: { id: dto.recipe_preparation_id } });
        if (!prep)
            throw new common_1.NotFoundException('Preparation not found');
        const code = dto.label_code || await this.generateCode(user);
        if (dto.label_code) {
            const existingLabel = await this.labelRepo.findOne({ where: { label_code: code } });
            if (existingLabel) {
                throw new common_1.NotFoundException(`Label code ${code} already exists. Please try again.`);
            }
        }
        const employeeId = user?.id || user?.userId || user?.id_employee || null;
        const path = `/files/recipes/labels/${code}.pdf`;
        const label = this.labelRepo.create({
            recipe_preparation_id: prep.id,
            label_code: code,
            label_file_path: path,
            generated_by_employee_id: employeeId
        });
        const savedLabel = await this.labelRepo.save(label);
        prep.is_labeled = true;
        await this.prepRepo.save(prep);
        return savedLabel;
    }
    async remove(id) {
        const label = await this.labelRepo.findOne({ where: { id } });
        if (!label)
            throw new common_1.NotFoundException('Label not found');
        await this.labelRepo.remove(label);
    }
    async emitExpiringLabelsNotifications() {
        const now = new Date();
        const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const labels = await this.labelRepo
            .createQueryBuilder('label')
            .leftJoinAndSelect('label.preparation', 'prep')
            .leftJoinAndSelect('prep.recipe', 'recipe')
            .where('prep.produced_at IS NOT NULL')
            .getMany();
        for (const label of labels) {
            const producedAt = label.preparation?.produced_at;
            const expHours = label.preparation?.recipe?.expiration_hours || 48;
            if (!producedAt)
                continue;
            const expirationAt = new Date(producedAt);
            expirationAt.setHours(expirationAt.getHours() + expHours);
            if (expirationAt > now && expirationAt <= inTwoHours) {
                try {
                    await (0, rxjs_1.firstValueFrom)(this.rmq.emit({ cmd: 'labels.expiring-soon' }, {
                        labelId: label.id,
                        labelCode: label.label_code,
                        preparationId: label.recipe_preparation_id,
                        expiresAt: expirationAt.toISOString(),
                    }));
                }
                catch {
                }
            }
        }
    }
};
exports.RecipesLabelsService = RecipesLabelsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RecipesLabelsService.prototype, "emitExpiringLabelsNotifications", null);
exports.RecipesLabelsService = RecipesLabelsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recipe_label_entity_1.RecipeLabel)),
    __param(1, (0, typeorm_1.InjectRepository)(recipe_preparation_entity_1.RecipePreparation)),
    __param(2, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        microservices_1.ClientProxy,
        axios_1.HttpService,
        config_1.ConfigService])
], RecipesLabelsService);
//# sourceMappingURL=recipes-labels.service.js.map
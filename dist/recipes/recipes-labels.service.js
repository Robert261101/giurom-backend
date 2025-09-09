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
const rxjs_1 = require("rxjs");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const recipe_label_entity_1 = require("./entities/recipe-label.entity");
const recipe_preparation_entity_1 = require("./entities/recipe-preparation.entity");
let RecipesLabelsService = class RecipesLabelsService {
    constructor(labelRepo, prepRepo, rmq) {
        this.labelRepo = labelRepo;
        this.prepRepo = prepRepo;
        this.rmq = rmq;
    }
    async findAll() {
        return this.labelRepo.find({ order: { generated_at: 'DESC' } });
    }
    async findOne(id) {
        const label = await this.labelRepo.findOne({ where: { id } });
        if (!label)
            throw new common_1.NotFoundException('Label not found');
        return label;
    }
    generateCode() {
        return `LBL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`;
    }
    async create(dto) {
        const prep = await this.prepRepo.findOne({ where: { id: dto.recipe_preparation_id } });
        if (!prep)
            throw new common_1.NotFoundException('Preparation not found');
        const code = dto.label_code || this.generateCode();
        const path = `/files/recipes/labels/${code}.pdf`;
        const label = this.labelRepo.create({ recipe_preparation_id: prep.id, label_code: code, label_file_path: path });
        return await this.labelRepo.save(label);
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
        microservices_1.ClientProxy])
], RecipesLabelsService);
//# sourceMappingURL=recipes-labels.service.js.map
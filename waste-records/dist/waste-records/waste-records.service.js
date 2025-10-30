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
exports.WasteRecordsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const waste_record_entity_1 = require("./entities/waste-record.entity");
let WasteRecordsService = class WasteRecordsService {
    constructor(repo) {
        this.repo = repo;
    }
    async create(dto) {
        const entity = this.repo.create({
            product_id: dto.product_id ?? null,
            recipe_id: dto.recipe_id ?? null,
            quantity: dto.quantity,
            unit: dto.unit,
            reason: dto.reason ?? null,
        });
        return this.repo.save(entity);
    }
    async findAll() {
        return this.repo.find({ order: { created_at: 'DESC' } });
    }
    async findOne(id) {
        const found = await this.repo.findOne({ where: { id } });
        if (!found)
            throw new common_1.NotFoundException('Waste record not found');
        return found;
    }
    async update(id, dto) {
        const found = await this.findOne(id);
        Object.assign(found, dto);
        return this.repo.save(found);
    }
    async remove(id) {
        const found = await this.findOne(id);
        await this.repo.remove(found);
        return { id };
    }
};
exports.WasteRecordsService = WasteRecordsService;
exports.WasteRecordsService = WasteRecordsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(waste_record_entity_1.WasteRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], WasteRecordsService);
//# sourceMappingURL=waste-records.service.js.map
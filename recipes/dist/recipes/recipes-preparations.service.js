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
exports.RecipePreparationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const recipe_preparation_entity_1 = require("./entities/recipe-preparation.entity");
const recipe_entity_1 = require("./entities/recipe.entity");
const stock_ref_entity_1 = require("../external/stock-ref.entity");
const stock_transaction_ref_entity_1 = require("../external/stock-transaction-ref.entity");
let RecipePreparationsService = class RecipePreparationsService {
    constructor(prepRepo, recipeRepo, stockRepo, txRepo) {
        this.prepRepo = prepRepo;
        this.recipeRepo = recipeRepo;
        this.stockRepo = stockRepo;
        this.txRepo = txRepo;
    }
    async findAll(page = 1, limit = 50) {
        const [rows] = await Promise.all([
            this.prepRepo.find({
                relations: ['recipe', 'recipe.category', 'labels'],
                order: { created_at: 'DESC' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        return rows;
    }
    async findOne(id) {
        const p = await this.prepRepo.findOne({
            where: { id },
            relations: ['recipe', 'recipe.category', 'labels']
        });
        if (!p)
            throw new common_1.NotFoundException('Preparation not found');
        return p;
    }
    async create(dto) {
        const recipe = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
        if (!recipe)
            throw new common_1.NotFoundException('Rețeta nu a fost găsită');
        const p = this.prepRepo.create({
            recipe_id: dto.recipe_id,
            produced_by: dto.employee_id,
            quantity: dto.quantity,
            produced_at: dto.produced_at ? new Date(dto.produced_at) : new Date(),
            is_labeled: false,
        });
        const saved = (await this.prepRepo.save(p));
        try {
            const fullRecipe = await this.recipeRepo.findOne({
                where: { id: dto.recipe_id },
                relations: ['recipe_products', 'recipe_products.product'],
            });
            if (fullRecipe && Array.isArray(fullRecipe.recipe_products)) {
                const baseQty = Number(fullRecipe.quantity) || 1;
                const factor = Number(dto.quantity) / baseQty;
                for (const rp of fullRecipe.recipe_products) {
                    const neededTotal = Number(rp.quantity) * factor;
                    if (!rp.product_id || !Number.isFinite(neededTotal) || neededTotal <= 0)
                        continue;
                    let remaining = neededTotal;
                    const stocks = await this.stockRepo.find({
                        where: { product_id: rp.product_id, status: stock_ref_entity_1.StockStatusRef.VALID, quantity: (0, typeorm_2.MoreThan)(0) },
                        order: { expiration_date: 'ASC', entry_date: 'ASC' },
                    });
                    const totalAvailable = stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
                    if (totalAvailable < neededTotal) {
                        throw new Error(`Cantitate insuficientă în stoc pentru produs ${rp.product_id}. Disponibil ${totalAvailable}, necesar ${neededTotal}`);
                    }
                    for (const s of stocks) {
                        if (remaining <= 0)
                            break;
                        const available = Number(s.quantity);
                        const toConsume = Math.min(available, remaining);
                        const tx = this.txRepo.create({
                            stock_id: s.id,
                            type: stock_transaction_ref_entity_1.TransactionTypeRef.EXIT,
                            quantity: toConsume,
                            location: 'production',
                            target: `recipe-preparation:${saved.id}`,
                            timestamp: new Date(),
                        });
                        await this.txRepo.save(tx);
                        s.quantity = (available - toConsume);
                        s.last_update = new Date();
                        await this.stockRepo.save(s);
                        remaining -= toConsume;
                    }
                }
            }
        }
        catch (e) {
            try {
                await this.prepRepo.remove(saved);
            }
            catch { }
            throw e;
        }
        return saved;
    }
    async update(id, dto) {
        const p = await this.findOne(id);
        Object.assign(p, dto);
        return this.prepRepo.save(p);
    }
    async remove(id) {
        const p = await this.findOne(id);
        await this.prepRepo.remove(p);
    }
    async prepareWithStock(dto) {
        const preparation = await this.create(dto);
        const stockTransactions = [
            {
                id: Date.now(),
                stock_id: 0,
                type: 'exit',
                quantity: dto.quantity,
                location: 'Bucătărie',
                target: `Preparare rețetă #${preparation.id}`,
                timestamp: new Date().toISOString(),
            },
        ];
        return { preparation, stockTransactions };
    }
};
exports.RecipePreparationsService = RecipePreparationsService;
exports.RecipePreparationsService = RecipePreparationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recipe_preparation_entity_1.RecipePreparation)),
    __param(1, (0, typeorm_1.InjectRepository)(recipe_entity_1.Recipe)),
    __param(2, (0, typeorm_1.InjectRepository)(stock_ref_entity_1.StockRef)),
    __param(3, (0, typeorm_1.InjectRepository)(stock_transaction_ref_entity_1.StockTransactionRef)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], RecipePreparationsService);
//# sourceMappingURL=recipes-preparations.service.js.map
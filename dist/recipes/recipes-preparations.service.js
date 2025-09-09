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
const axios_1 = require("axios");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const recipe_preparation_entity_1 = require("./entities/recipe-preparation.entity");
const recipe_entity_1 = require("./entities/recipe.entity");
let RecipePreparationsService = class RecipePreparationsService {
    constructor(prepRepo, recipeRepo) {
        this.prepRepo = prepRepo;
        this.recipeRepo = recipeRepo;
    }
    async findAll(page = 1, limit = 50) {
        const [rows] = await Promise.all([
            this.prepRepo.find({
                relations: ['recipe', 'recipe.category', 'recipe.recipe_products'],
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
            relations: ['recipe', 'recipe.category', 'recipe.recipe_products']
        });
        if (!p)
            throw new common_1.NotFoundException('Preparation not found');
        return p;
    }
    async create(dto) {
        const recipe = await this.recipeRepo.findOne({
            where: { id: dto.recipe_id },
            relations: ['recipe_products']
        });
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
        await this.consumeStockForPreparation(recipe, dto.quantity);
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
    async consumeStockForPreparation(recipe, preparationQuantity) {
        console.log(`🔄 Starting stock consumption for recipe: ${recipe.name}, quantity: ${preparationQuantity}`);
        try {
            const originalRecipeQuantity = recipe.quantity || 1000;
            const scalingFactor = preparationQuantity / originalRecipeQuantity;
            console.log(`📊 Recipe original quantity: ${originalRecipeQuantity}g, preparation quantity: ${preparationQuantity}g, scaling factor: ${scalingFactor.toFixed(2)}x`);
            for (const ingredient of recipe.recipe_products || []) {
                const scaledQuantity = ingredient.quantity * scalingFactor;
                console.log(`🥄 Processing ingredient: product_id=${ingredient.product_id}, original=${ingredient.quantity}, scaled=${scaledQuantity.toFixed(2)}`);
                console.log(`🥄 Ingredient details:`, JSON.stringify(ingredient, null, 2));
                const consumeData = {
                    product_id: ingredient.product_id,
                    quantity: scaledQuantity,
                    target: `Preparare rețetă: ${recipe.name}`
                };
                console.log(`📤 Sending consume request to stock service:`, consumeData);
                const response = await axios_1.default.post('http://localhost:3005/stock/consume', consumeData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`✅ Stock service response:`, response.status, response.data);
                console.log(`✅ Consumed ${scaledQuantity} units of product ${ingredient.product_id} for recipe ${recipe.name}`);
            }
        }
        catch (error) {
            console.error('❌ Failed to consume stock for preparation:', error);
            if (error.response) {
                console.error('❌ Stock service error response:', error.response.status, error.response.data);
            }
        }
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], RecipePreparationsService);
//# sourceMappingURL=recipes-preparations.service.js.map
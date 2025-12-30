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
const microservices_1 = require("@nestjs/microservices");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const recipe_preparation_entity_1 = require("./entities/recipe-preparation.entity");
const recipe_entity_1 = require("./entities/recipe.entity");
let RecipePreparationsService = class RecipePreparationsService {
    constructor(prepRepo, recipeRepo, notificationsClient, httpService, configService) {
        this.prepRepo = prepRepo;
        this.recipeRepo = recipeRepo;
        this.notificationsClient = notificationsClient;
        this.httpService = httpService;
        this.configService = configService;
        this.stockServiceUrl = this.configService.get('STOCK_HTTP_URL') || 'http://localhost:3006';
    }
    async sendPreparationNotification(type, title, description, preparationId, recipeId, metadata, target_url) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: 'recipes.notification' }, {
                type,
                title,
                description,
                entity_id: preparationId,
                entity_type: 'recipe_preparation',
                metadata: {
                    ...metadata,
                    recipeId,
                },
                priority: 'medium',
                target_url,
            }));
        }
        catch (error) {
            console.error('Failed to send preparation notification:', error);
        }
    }
    async findAll(page = 1, limit = 50, locationId) {
        const queryBuilder = this.prepRepo.createQueryBuilder('preparation')
            .leftJoinAndSelect('preparation.recipe', 'recipe')
            .leftJoinAndSelect('recipe.category', 'category')
            .leftJoinAndSelect('preparation.labels', 'labels');
        if (locationId !== undefined) {
            queryBuilder.andWhere('preparation.location_id = :locationId', { locationId });
            console.log('🔍 [RecipePreparationsService] Filtrăm preparations după location_id:', locationId);
        }
        else {
            queryBuilder.andWhere('preparation.location_id IS NOT NULL');
        }
        const rows = await queryBuilder
            .orderBy('preparation.created_at', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();
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
            location_id: dto.location_id,
            quantity: dto.quantity,
            produced_at: dto.produced_at ? new Date(dto.produced_at) : new Date(),
            is_labeled: false,
            is_consumable: recipe.is_consumable || false,
        });
        const saved = (await this.prepRepo.save(p));
        await this.sendPreparationNotification('recipe_preparation_created', 'Preparat realizat', `A fost realizat un nou preparat pentru reteta: ${recipe.name}`, saved.id, recipe.id, {
            recipeName: recipe.name,
            quantity: dto.quantity,
            producedBy: dto.employee_id
        }, `/retetar/preparate/${saved.id}`);
        try {
            await this.consumeRecipeIngredients(dto.recipe_id, dto.quantity, saved.id);
        }
        catch (e) {
            console.error(`❌ [RecipePreparationsService] Rolling back preparation ${saved.id} due to stock consumption error`);
            try {
                await this.prepRepo.remove(saved);
            }
            catch (rollbackError) {
                console.error(`❌ [RecipePreparationsService] Error during rollback:`, rollbackError);
            }
            throw e;
        }
        return saved;
    }
    async consumeRecipeIngredients(recipeId, quantity, preparationId, visitedRecipeIds = new Set()) {
        if (visitedRecipeIds.has(recipeId)) {
            throw new common_1.BadRequestException(`Referință circulară detectată pentru rețeta ${recipeId}`);
        }
        visitedRecipeIds.add(recipeId);
        const fullRecipe = await this.recipeRepo.findOne({
            where: { id: recipeId },
            relations: ['recipe_products', 'recipe_recipes', 'recipe_recipes.ingredient_recipe'],
        });
        if (!fullRecipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${recipeId} not found`);
        }
        const baseQty = Number(fullRecipe.quantity) || 1;
        const factor = Number(quantity) / baseQty;
        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
        const headers = {
            'x-internal-service': 'recipes',
            'x-service-secret': serviceSecret
        };
        if (Array.isArray(fullRecipe.recipe_products)) {
            for (const rp of fullRecipe.recipe_products) {
                const neededTotal = Number(rp.quantity) * factor;
                if (!rp.product_id || !Number.isFinite(neededTotal) || neededTotal <= 0)
                    continue;
                console.log(`🔍 [RecipePreparationsService] Consuming ${neededTotal} units of product ${rp.product_id} for preparation ${preparationId}`);
                try {
                    await (0, rxjs_1.lastValueFrom)(this.httpService.post(`${this.stockServiceUrl}/stock/consume`, {
                        product_id: rp.product_id,
                        quantity: neededTotal,
                        target: `recipe-preparation:${preparationId}`
                    }, { headers }));
                    console.log(`✅ [RecipePreparationsService] Successfully consumed ${neededTotal} units of product ${rp.product_id}`);
                }
                catch (error) {
                    console.error(`❌ [RecipePreparationsService] Error consuming product ${rp.product_id}:`, error?.response?.data || error?.message);
                    const errorMessage = error?.response?.data?.message || error?.message || 'Eroare necunoscută la consumarea stocului';
                    throw new common_1.BadRequestException(`Cantitate insuficientă în stoc pentru produs ${rp.product_id}. ${errorMessage}`);
                }
            }
        }
        if (Array.isArray(fullRecipe.recipe_recipes)) {
            for (const rr of fullRecipe.recipe_recipes) {
                if (!rr.ingredient_recipe_id || !rr.ingredient_recipe)
                    continue;
                const neededRecipeQuantity = Number(rr.quantity) * factor;
                console.log(`🔍 [RecipePreparationsService] Consuming ${neededRecipeQuantity} units of recipe ${rr.ingredient_recipe_id} (${rr.ingredient_recipe.name}) for preparation ${preparationId}`);
                if (rr.ingredient_recipe_id === recipeId) {
                    throw new common_1.BadRequestException(`Rețeta ${recipeId} nu poate conține ca ingredient rețeta ${rr.ingredient_recipe_id} (referință circulară directă)`);
                }
                const newVisitedSet = new Set(visitedRecipeIds);
                await this.consumeRecipeIngredients(rr.ingredient_recipe_id, neededRecipeQuantity, preparationId, newVisitedSet);
                console.log(`✅ [RecipePreparationsService] Successfully consumed recipe ${rr.ingredient_recipe_id} (${rr.ingredient_recipe.name})`);
            }
        }
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
    __param(2, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        microservices_1.ClientProxy,
        axios_1.HttpService,
        config_1.ConfigService])
], RecipePreparationsService);
//# sourceMappingURL=recipes-preparations.service.js.map
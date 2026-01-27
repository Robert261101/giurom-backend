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
exports.RecipeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
const recipe_entity_1 = require("./entities/recipe.entity");
const recipe_category_entity_1 = require("./entities/recipe-category.entity");
const recipe_product_entity_1 = require("./entities/recipe-product.entity");
const recipe_recipe_entity_1 = require("./entities/recipe-recipe.entity");
const recipe_location_entity_1 = require("./entities/recipe-location.entity");
const recipes_media_service_1 = require("./recipes-media.service");
let RecipeService = class RecipeService {
    constructor(recipesRepository, categoriesRepository, recipeProductsRepository, recipeRecipesRepository, recipeLocationRepository, recipeMediaService, httpService, configService, notificationsClient) {
        this.recipesRepository = recipesRepository;
        this.categoriesRepository = categoriesRepository;
        this.recipeProductsRepository = recipeProductsRepository;
        this.recipeRecipesRepository = recipeRecipesRepository;
        this.recipeLocationRepository = recipeLocationRepository;
        this.recipeMediaService = recipeMediaService;
        this.httpService = httpService;
        this.configService = configService;
        this.notificationsClient = notificationsClient;
        this.stockServiceUrl = this.configService.get('STOCK_HTTP_URL') || 'http://localhost:3006';
    }
    async sendRecipeNotification(type, title, description, recipeId, metadata, target_url) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: 'recipes.notification' }, {
                type,
                title,
                description,
                entity_id: recipeId,
                entity_type: 'recipe',
                metadata,
                priority: 'medium',
                target_url,
            }));
        }
        catch (error) {
            console.error('Failed to send recipe notification:', error);
        }
    }
    async create(createRecipeDto, location_id) {
        const { is_consumable, ...rest } = createRecipeDto;
        const recipe = this.recipesRepository.create(rest);
        const savedRecipe = await this.recipesRepository.save(recipe);
        if (location_id) {
            try {
                const recipeLocation = this.recipeLocationRepository.create({
                    recipeId: savedRecipe.id,
                    idLocation: location_id,
                    isConsumable: !!is_consumable,
                });
                await this.recipeLocationRepository.save(recipeLocation);
                console.log(`✅ [RecipesService] Rețeta ${savedRecipe.id} a fost asignată automat la locația ${location_id}`);
            }
            catch (error) {
                console.warn(`⚠️ [RecipesService] Eroare la asignarea automată a rețetei ${savedRecipe.id} la locația ${location_id}:`, error);
            }
        }
        await this.sendRecipeNotification('recipe_created', 'Reteta noua creata', `A fost creata o noua reteta: ${savedRecipe.name}`, savedRecipe.id, { recipeName: savedRecipe.name }, `/retetar/${savedRecipe.id}`);
        if (location_id)
            savedRecipe.is_consumable = !!createRecipeDto.is_consumable;
        return savedRecipe;
    }
    async findAll(params) {
        const page = params.page ?? 1;
        const limit = params.limit ?? 10;
        const queryBuilder = this.recipesRepository.createQueryBuilder('recipe')
            .leftJoinAndSelect('recipe.category', 'category')
            .leftJoinAndSelect('recipe.recipe_products', 'recipe_products');
        if (params.search) {
            queryBuilder.andWhere('recipe.name LIKE :search', { search: `%${params.search}%` });
        }
        if (params.category_id) {
            queryBuilder.andWhere('recipe.category_id = :category_id', { category_id: params.category_id });
        }
        queryBuilder
            .leftJoinAndSelect('recipe.recipeLocations', 'recipe_location')
            .andWhere('recipe_location.idLocation = :location_id', { location_id: params.location_id });
        console.log('🔍 [RecipesService] Filtrăm recipes după location_id (prin recipe_locations):', params.location_id);
        const offset = (page - 1) * limit;
        const [recipes, total] = await queryBuilder
            .orderBy('recipe.created_at', 'DESC')
            .take(limit)
            .skip(offset)
            .getManyAndCount();
        for (const r of recipes) {
            const rl = Array.isArray(r.recipeLocations) ? r.recipeLocations[0] : undefined;
            r.is_consumable = rl?.isConsumable ?? false;
        }
        for (const recipe of recipes) {
            if (recipe.recipe_products && recipe.recipe_products.length > 0) {
                for (const recipeProduct of recipe.recipe_products) {
                    if (recipeProduct.product_id) {
                        try {
                            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                                headers: {
                                    'x-internal-service': 'recipes',
                                    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
                                }
                            }));
                            recipeProduct.product = response.data;
                        }
                        catch (error) {
                            recipeProduct.product = null;
                        }
                    }
                }
            }
        }
        const totalPages = Math.ceil(total / limit);
        return { recipes, total, totalPages };
    }
    async findOne(id, location_id) {
        const recipe = await this.recipesRepository.findOne({
            where: { id },
            relations: ['category', 'recipe_products', 'recipe_recipes', 'recipe_recipes.ingredient_recipe', 'recipeMedia', 'recipeLocations'],
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${id} not found`);
        }
        if (location_id !== undefined) {
            const isAssignedToLocation = recipe.recipeLocations?.some((rl) => rl.idLocation === location_id);
            if (!isAssignedToLocation) {
                throw new common_1.NotFoundException(`Rețeta cu ID ${id} nu este asignată la locația specificată`);
            }
        }
        if (location_id !== undefined) {
            const rl = recipe.recipeLocations?.find((x) => x.idLocation === location_id);
            recipe.is_consumable = rl?.isConsumable ?? false;
        }
        if (recipe.recipe_products && recipe.recipe_products.length > 0) {
            for (const recipeProduct of recipe.recipe_products) {
                if (recipeProduct.product_id) {
                    try {
                        const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                            headers: {
                                'x-internal-service': 'recipes',
                                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
                            }
                        }));
                        recipeProduct.product = response.data;
                    }
                    catch (error) {
                        recipeProduct.product = null;
                    }
                }
            }
        }
        return recipe;
    }
    async update(id, updateRecipeDto, location_id) {
        const recipe = await this.findOne(id, undefined);
        const oldName = recipe.name;
        const { is_consumable, ...rest } = updateRecipeDto;
        Object.assign(recipe, rest);
        const updatedRecipe = await this.recipesRepository.save(recipe);
        if (location_id !== undefined && is_consumable !== undefined) {
            const existing = await this.recipeLocationRepository.findOne({
                where: { recipeId: id, idLocation: location_id },
            });
            if (existing) {
                existing.isConsumable = !!is_consumable;
                await this.recipeLocationRepository.save(existing);
            }
            else {
                const rl = this.recipeLocationRepository.create({
                    recipeId: id,
                    idLocation: location_id,
                    isConsumable: !!is_consumable,
                });
                await this.recipeLocationRepository.save(rl);
            }
            updatedRecipe.is_consumable = !!is_consumable;
        }
        await this.sendRecipeNotification('recipe_updated', 'Reteta modificata', `Reteta ${oldName} a fost modificata`, updatedRecipe.id, {
            oldName,
            newName: updatedRecipe.name,
            updatedFields: Object.keys(updateRecipeDto)
        }, `/retetar/${updatedRecipe.id}`);
        return updatedRecipe;
    }
    async remove(id) {
        const recipe = await this.findOne(id, undefined);
        const recipeName = recipe.name;
        await this.recipesRepository.remove(recipe);
        await this.sendRecipeNotification('recipe_deleted', 'Reteta stearsa', `Reteta ${recipeName} a fost stearsa`, id, { recipeName }, `/retetar/${id}`);
    }
    async createCategory(createCategoryDto) {
        const category = this.categoriesRepository.create(createCategoryDto);
        return await this.categoriesRepository.save(category);
    }
    async findAllCategories(params) {
        const page = params.page ?? 1;
        const limit = params.limit ?? 10;
        const queryBuilder = this.categoriesRepository.createQueryBuilder('category');
        if (params.search) {
            queryBuilder.andWhere('category.name LIKE :search', { search: `%${params.search}%` });
        }
        const offset = (page - 1) * limit;
        const [categories, total] = await queryBuilder
            .orderBy('category.created_at', 'DESC')
            .take(limit)
            .skip(offset)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return { categories, total, totalPages };
    }
    async findOneCategory(id) {
        const category = await this.categoriesRepository.findOne({
            where: { id },
            relations: ['recipes'],
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with ID ${id} not found`);
        }
        return category;
    }
    async updateCategory(id, updateCategoryDto) {
        const category = await this.findOneCategory(id);
        Object.assign(category, updateCategoryDto);
        return await this.categoriesRepository.save(category);
    }
    async removeCategory(id) {
        const category = await this.findOneCategory(id);
        await this.categoriesRepository.remove(category);
    }
    async addProductToRecipe(createRecipeProductDto) {
        const recipe = await this.recipesRepository.findOne({
            where: { id: createRecipeProductDto.recipe_id }
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${createRecipeProductDto.recipe_id} not found`);
        }
        try {
            const productUrl = `${this.stockServiceUrl}/stock/products/${createRecipeProductDto.product_id}`;
            const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
            const headers = {
                'x-internal-service': 'recipes',
                'x-service-secret': serviceSecret
            };
            console.log(`🔍 [RecipesService] Verifying product ${createRecipeProductDto.product_id} at: ${productUrl}`);
            console.log(`🔑 [RecipesService] Using service secret: ${serviceSecret.substring(0, 5)}...`);
            console.log(`📤 [RecipesService] Headers:`, headers);
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(productUrl, { headers }));
            console.log(`✅ [RecipesService] Product ${createRecipeProductDto.product_id} verified:`, response.data);
        }
        catch (error) {
            console.error(`❌ [RecipesService] Error verifying product ${createRecipeProductDto.product_id}:`, error?.response?.data || error?.message);
            console.error(`❌ [RecipesService] Full error:`, error?.response?.status, error?.response?.statusText);
            throw new common_1.BadRequestException(`Product with ID ${createRecipeProductDto.product_id} not found`);
        }
        const recipeProduct = this.recipeProductsRepository.create(createRecipeProductDto);
        return await this.recipeProductsRepository.save(recipeProduct);
    }
    async findRecipeProducts(recipe_id) {
        const recipe = await this.recipesRepository.findOne({
            where: { id: recipe_id }
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${recipe_id} not found`);
        }
        const recipeProducts = await this.recipeProductsRepository.find({
            where: { recipe_id },
            relations: ['recipe'],
        });
        for (const recipeProduct of recipeProducts) {
            if (recipeProduct.product_id) {
                try {
                    const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                        headers: {
                            'x-internal-service': 'recipes',
                            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
                        }
                    }));
                    recipeProduct.product = response.data;
                }
                catch (error) {
                    recipeProduct.product = null;
                }
            }
        }
        return recipeProducts;
    }
    async updateRecipeProduct(id, updateRecipeProductDto) {
        const recipeProduct = await this.recipeProductsRepository.findOne({
            where: { id },
            relations: ['recipe'],
        });
        if (!recipeProduct) {
            throw new common_1.NotFoundException(`Recipe product with ID ${id} not found`);
        }
        if (updateRecipeProductDto.product_id && updateRecipeProductDto.product_id !== recipeProduct.product_id) {
            try {
                await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/products/${updateRecipeProductDto.product_id}`, {
                    headers: {
                        'x-internal-service': 'recipes',
                        'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
                    }
                }));
            }
            catch (error) {
                throw new common_1.BadRequestException(`Product with ID ${updateRecipeProductDto.product_id} not found`);
            }
        }
        Object.assign(recipeProduct, updateRecipeProductDto);
        return await this.recipeProductsRepository.save(recipeProduct);
    }
    async removeRecipeProduct(id) {
        const recipeProduct = await this.recipeProductsRepository.findOne({
            where: { id },
        });
        if (!recipeProduct) {
            throw new common_1.NotFoundException(`Recipe product with ID ${id} not found`);
        }
        await this.recipeProductsRepository.remove(recipeProduct);
    }
    async addRecipeToRecipe(recipeId, ingredientRecipeId, quantity, notes) {
        const recipe = await this.recipesRepository.findOne({
            where: { id: recipeId }
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${recipeId} not found`);
        }
        const ingredientRecipe = await this.recipesRepository.findOne({
            where: { id: ingredientRecipeId }
        });
        if (!ingredientRecipe) {
            throw new common_1.NotFoundException(`Ingredient recipe with ID ${ingredientRecipeId} not found`);
        }
        if (recipeId === ingredientRecipeId) {
            throw new common_1.BadRequestException('Nu poți adăuga o rețetă ca ingredient la ea însăși');
        }
        const existing = await this.recipeRecipesRepository.findOne({
            where: { recipe_id: recipeId, ingredient_recipe_id: ingredientRecipeId }
        });
        if (existing) {
            throw new common_1.BadRequestException('Această rețetă este deja adăugată ca ingredient');
        }
        const recipeRecipe = this.recipeRecipesRepository.create({
            recipe_id: recipeId,
            ingredient_recipe_id: ingredientRecipeId,
            quantity,
            notes
        });
        return await this.recipeRecipesRepository.save(recipeRecipe);
    }
    async getRecipeRecipes(recipeId) {
        const recipeRecipes = await this.recipeRecipesRepository.find({
            where: { recipe_id: recipeId },
            relations: ['ingredient_recipe', 'ingredient_recipe.category'],
            order: { created_at: 'ASC' }
        });
        return recipeRecipes;
    }
    async updateRecipeRecipe(id, quantity, notes) {
        const recipeRecipe = await this.recipeRecipesRepository.findOne({
            where: { id },
            relations: ['recipe', 'ingredient_recipe']
        });
        if (!recipeRecipe) {
            throw new common_1.NotFoundException(`Recipe recipe with ID ${id} not found`);
        }
        recipeRecipe.quantity = quantity;
        if (notes !== undefined) {
            recipeRecipe.notes = notes;
        }
        return await this.recipeRecipesRepository.save(recipeRecipe);
    }
    async removeRecipeRecipe(id) {
        const recipeRecipe = await this.recipeRecipesRepository.findOne({
            where: { id },
        });
        if (!recipeRecipe) {
            throw new common_1.NotFoundException(`Recipe recipe with ID ${id} not found`);
        }
        await this.recipeRecipesRepository.remove(recipeRecipe);
    }
    async getStatistics() {
        const total = await this.recipesRepository.count();
        const byCategory = await this.recipesRepository
            .createQueryBuilder('recipe')
            .select('category.name', 'category')
            .addSelect('COUNT(recipe.id)', 'count')
            .leftJoin('recipe.category', 'category')
            .groupBy('category.name')
            .getRawMany();
        return {
            total,
            byCategory,
        };
    }
    async getScaledIngredientsWithStock(recipeId, quantity) {
        const recipe = await this.recipesRepository.findOne({
            where: { id: recipeId },
            relations: ['recipe_products'],
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Rețeta cu ID ${recipeId} nu a fost găsită`);
        }
        const baseQty = Number(recipe.quantity) || 1;
        const scalingFactor = Number(quantity) / baseQty;
        const wholeNumberUnits = ['buc', 'bucati', 'bucăți', 'sticla', 'sticle', 'cutie', 'cutii', 'pachet', 'pachete'];
        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
        const headers = {
            'x-internal-service': 'recipes',
            'x-service-secret': serviceSecret
        };
        const result = [];
        if (Array.isArray(recipe.recipe_products)) {
            for (const rp of recipe.recipe_products) {
                if (!rp.product_id)
                    continue;
                const originalQuantity = Number(rp.quantity) || 0;
                let scaledQuantity = originalQuantity * scalingFactor;
                console.log(`🔍 [RecipeService] Ingredient calculation: product_id=${rp.product_id}, originalQuantity=${originalQuantity}, scalingFactor=${scalingFactor}, scaledQuantity=${scaledQuantity}`);
                let productUnit = 'g';
                let productName = 'Ingredient necunoscut';
                try {
                    const productResponse = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/products/${rp.product_id}`, {
                        headers
                    }));
                    if (productResponse.data) {
                        productUnit = productResponse.data.unit || 'g';
                        productName = productResponse.data.name || 'Ingredient necunoscut';
                    }
                }
                catch (error) {
                    console.warn(`⚠️ [RecipeService] Nu s-a putut încărca produsul ${rp.product_id}`);
                }
                const requiresWholeNumber = wholeNumberUnits.some(unit => productUnit?.toLowerCase().includes(unit.toLowerCase()));
                const finalQuantity = requiresWholeNumber
                    ? Math.ceil(scaledQuantity)
                    : Math.round(scaledQuantity * 100) / 100;
                let availableQuantity = 0;
                try {
                    const stockResponse = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/items`, {
                        headers,
                        params: {
                            product_id: rp.product_id,
                            limit: 1000
                        }
                    }));
                    const stockItems = stockResponse.data?.data || stockResponse.data || [];
                    if (Array.isArray(stockItems)) {
                        const validStockItems = stockItems.filter((item) => {
                            const quantity = parseFloat(item.quantity?.toString() || '0') || 0;
                            const status = item.status?.toLowerCase();
                            return status === 'valid' && quantity > 0;
                        });
                        availableQuantity = validStockItems.reduce((sum, item) => {
                            return sum + (parseFloat(item.quantity?.toString() || '0') || 0);
                        }, 0);
                        console.log(`📊 [RecipeService] Product ${rp.product_id} (${productName}): total stock items=${stockItems.length}, valid items=${validStockItems.length}, availableQuantity=${availableQuantity}${productUnit}`);
                    }
                }
                catch (error) {
                    console.error(`⚠️ [RecipeService] Eroare la verificarea stocului pentru produs ${rp.product_id}:`, error?.response?.data || error?.message);
                    availableQuantity = 0;
                }
                result.push({
                    product_id: rp.product_id,
                    product_name: productName,
                    unit: productUnit,
                    required_quantity: finalQuantity,
                    available_quantity: availableQuantity,
                    sufficient: availableQuantity >= finalQuantity,
                });
            }
        }
        return result;
    }
    async assignRecipeToLocation(assignDto) {
        const recipe = await this.recipesRepository.findOne({ where: { id: assignDto.recipe_id } });
        if (!recipe) {
            throw new common_1.NotFoundException(`Rețeta cu ID-ul ${assignDto.recipe_id} nu a fost găsită`);
        }
        const existingAssignment = await this.recipeLocationRepository.findOne({
            where: {
                recipeId: assignDto.recipe_id,
                idLocation: assignDto.id_location,
            },
        });
        if (existingAssignment) {
            throw new common_1.BadRequestException(`Rețeta este deja asignată la această locație`);
        }
        const recipeLocation = this.recipeLocationRepository.create({
            recipeId: assignDto.recipe_id,
            idLocation: assignDto.id_location,
            isConsumable: !!assignDto.is_consumable,
        });
        return await this.recipeLocationRepository.save(recipeLocation);
    }
    async findRecipeLocations(recipe_id) {
        return await this.recipeLocationRepository.find({
            where: { recipeId: recipe_id },
            order: { createdAt: 'DESC' },
        });
    }
    async removeRecipeFromLocation(recipe_id, location_id) {
        const assignment = await this.recipeLocationRepository.findOne({
            where: {
                recipeId: recipe_id,
                idLocation: location_id,
            },
        });
        if (!assignment) {
            throw new common_1.NotFoundException(`Rețeta nu este asignată la această locație`);
        }
        await this.recipeLocationRepository.remove(assignment);
    }
};
exports.RecipeService = RecipeService;
exports.RecipeService = RecipeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recipe_entity_1.Recipe)),
    __param(1, (0, typeorm_1.InjectRepository)(recipe_category_entity_1.RecipeCategory)),
    __param(2, (0, typeorm_1.InjectRepository)(recipe_product_entity_1.RecipeProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(recipe_recipe_entity_1.RecipeRecipe)),
    __param(4, (0, typeorm_1.InjectRepository)(recipe_location_entity_1.RecipeLocation)),
    __param(8, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        recipes_media_service_1.RecipeMediaService,
        axios_1.HttpService,
        config_1.ConfigService,
        microservices_1.ClientProxy])
], RecipeService);
//# sourceMappingURL=recipes.service.js.map
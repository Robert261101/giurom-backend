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
const recipes_media_service_1 = require("./recipes-media.service");
let RecipeService = class RecipeService {
    constructor(recipesRepository, categoriesRepository, recipeProductsRepository, recipeRecipesRepository, recipeMediaService, httpService, configService, notificationsClient) {
        this.recipesRepository = recipesRepository;
        this.categoriesRepository = categoriesRepository;
        this.recipeProductsRepository = recipeProductsRepository;
        this.recipeRecipesRepository = recipeRecipesRepository;
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
    async create(createRecipeDto) {
        const recipe = this.recipesRepository.create(createRecipeDto);
        const savedRecipe = await this.recipesRepository.save(recipe);
        await this.sendRecipeNotification('recipe_created', 'Reteta noua creata', `A fost creata o noua reteta: ${savedRecipe.name}`, savedRecipe.id, { recipeName: savedRecipe.name }, `/retetar/${savedRecipe.id}`);
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
        queryBuilder.andWhere('recipe.location_id IS NOT NULL');
        if (params.location_id !== undefined) {
            queryBuilder.andWhere('recipe.location_id = :location_id', { location_id: params.location_id });
            console.log('🔍 [RecipesService] Filtrăm recipes după location_id:', params.location_id);
        }
        const offset = (page - 1) * limit;
        const [recipes, total] = await queryBuilder
            .orderBy('recipe.created_at', 'DESC')
            .take(limit)
            .skip(offset)
            .getManyAndCount();
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
    async findOne(id) {
        const recipe = await this.recipesRepository.findOne({
            where: { id },
            relations: ['category', 'recipe_products', 'recipe_recipes', 'recipe_recipes.ingredient_recipe', 'recipeMedia'],
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${id} not found`);
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
    async update(id, updateRecipeDto) {
        const recipe = await this.findOne(id);
        const oldName = recipe.name;
        Object.assign(recipe, updateRecipeDto);
        const updatedRecipe = await this.recipesRepository.save(recipe);
        await this.sendRecipeNotification('recipe_updated', 'Reteta modificata', `Reteta ${oldName} a fost modificata`, updatedRecipe.id, {
            oldName,
            newName: updatedRecipe.name,
            updatedFields: Object.keys(updateRecipeDto)
        }, `/retetar/${updatedRecipe.id}`);
        return updatedRecipe;
    }
    async remove(id) {
        const recipe = await this.findOne(id);
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
};
exports.RecipeService = RecipeService;
exports.RecipeService = RecipeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recipe_entity_1.Recipe)),
    __param(1, (0, typeorm_1.InjectRepository)(recipe_category_entity_1.RecipeCategory)),
    __param(2, (0, typeorm_1.InjectRepository)(recipe_product_entity_1.RecipeProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(recipe_recipe_entity_1.RecipeRecipe)),
    __param(7, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        recipes_media_service_1.RecipeMediaService,
        axios_1.HttpService,
        config_1.ConfigService,
        microservices_1.ClientProxy])
], RecipeService);
//# sourceMappingURL=recipes.service.js.map
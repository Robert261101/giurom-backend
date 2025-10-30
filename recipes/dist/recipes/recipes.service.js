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
exports.RecipesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const recipe_entity_1 = require("./entities/recipe.entity");
const recipe_category_entity_1 = require("./entities/recipe-category.entity");
const recipe_product_entity_1 = require("./entities/recipe-product.entity");
const recipes_media_service_1 = require("./recipes-media.service");
let RecipesService = class RecipesService {
    constructor(recipesRepository, categoriesRepository, recipeProductsRepository, recipeMediaService, httpService) {
        this.recipesRepository = recipesRepository;
        this.categoriesRepository = categoriesRepository;
        this.recipeProductsRepository = recipeProductsRepository;
        this.recipeMediaService = recipeMediaService;
        this.httpService = httpService;
    }
    async create(createRecipeDto) {
        const recipe = this.recipesRepository.create(createRecipeDto);
        return await this.recipesRepository.save(recipe);
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
                            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`http://localhost:3000/api/stock/products/${recipeProduct.product_id}`));
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
            relations: ['category', 'recipe_products', 'recipeMedia'],
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Recipe with ID ${id} not found`);
        }
        if (recipe.recipe_products && recipe.recipe_products.length > 0) {
            for (const recipeProduct of recipe.recipe_products) {
                if (recipeProduct.product_id) {
                    try {
                        const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`http://localhost:3000/api/stock/products/${recipeProduct.product_id}`));
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
        Object.assign(recipe, updateRecipeDto);
        return await this.recipesRepository.save(recipe);
    }
    async remove(id) {
        const recipe = await this.findOne(id);
        await this.recipesRepository.remove(recipe);
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
            await (0, rxjs_1.lastValueFrom)(this.httpService.get(`http://localhost:3000/api/stock/products/${createRecipeProductDto.product_id}`));
        }
        catch (error) {
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
                    const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`http://localhost:3000/api/stock/products/${recipeProduct.product_id}`));
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
                await (0, rxjs_1.lastValueFrom)(this.httpService.get(`http://localhost:3000/api/stock/products/${updateRecipeProductDto.product_id}`));
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
exports.RecipesService = RecipesService;
exports.RecipesService = RecipesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recipe_entity_1.Recipe)),
    __param(1, (0, typeorm_1.InjectRepository)(recipe_category_entity_1.RecipeCategory)),
    __param(2, (0, typeorm_1.InjectRepository)(recipe_product_entity_1.RecipeProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        recipes_media_service_1.RecipeMediaService,
        axios_1.HttpService])
], RecipesService);
//# sourceMappingURL=recipes.service.js.map
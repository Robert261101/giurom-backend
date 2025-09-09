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
const recipe_entity_1 = require("./entities/recipe.entity");
const recipe_category_entity_1 = require("./entities/recipe-category.entity");
const recipe_product_entity_1 = require("./entities/recipe-product.entity");
let RecipesService = class RecipesService {
    constructor(recipeRepository, categoryRepository, recipeProductRepository) {
        this.recipeRepository = recipeRepository;
        this.categoryRepository = categoryRepository;
        this.recipeProductRepository = recipeProductRepository;
    }
    async createRecipeCategory(dto) {
        const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
        if (existing)
            throw new common_1.ConflictException('Categoria există deja');
        const category = this.categoryRepository.create(dto);
        return await this.categoryRepository.save(category);
    }
    async findAllRecipeCategories(page = 1, limit = 10, search) {
        const safePage = Number.isFinite(page) && page > 0 ? page : 1;
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
        const where = search ? { name: (0, typeorm_2.Like)(`%${search}%`) } : {};
        const [data, total] = await this.categoryRepository.findAndCount({
            where,
            relations: ['recipes'],
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
            order: { name: 'ASC' },
        });
        return { data, total, page: safePage, limit: safeLimit };
    }
    async findRecipeCategoryById(id) {
        const category = await this.categoryRepository.findOne({ where: { id }, relations: ['recipes'] });
        if (!category)
            throw new common_1.NotFoundException('Categoria nu a fost găsită');
        return category;
    }
    async updateRecipeCategory(id, dto) {
        const category = await this.findRecipeCategoryById(id);
        if (dto.name && dto.name !== category.name) {
            const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
            if (existing)
                throw new common_1.ConflictException('Categoria există deja');
        }
        Object.assign(category, dto);
        return await this.categoryRepository.save(category);
    }
    async deleteRecipeCategory(id) {
        const category = await this.findRecipeCategoryById(id);
        const recipeCount = await this.recipeRepository.count({ where: { category_id: id } });
        if (recipeCount > 0)
            throw new common_1.BadRequestException('Categoria are rețete asociate');
        await this.categoryRepository.remove(category);
    }
    async createRecipe(dto) {
        const category = await this.categoryRepository.findOne({ where: { id: dto.category_id } });
        if (!category)
            throw new common_1.NotFoundException('Categoria nu a fost găsită');
        const recipe = this.recipeRepository.create(dto);
        return await this.recipeRepository.save(recipe);
    }
    async findAllRecipes(page = 1, limit = 10, search, category_id) {
        const qb = this.recipeRepository.createQueryBuilder('recipe')
            .leftJoinAndSelect('recipe.category', 'category')
            .leftJoinAndSelect('recipe.recipe_products', 'rp');
        if (search) {
            qb.andWhere('recipe.name LIKE :s OR recipe.description LIKE :s', { s: `%${search}%` });
        }
        if (Number.isFinite(category_id) && category_id > 0) {
            qb.andWhere('recipe.category_id = :cid', { cid: category_id });
        }
        const safePage = Number.isFinite(page) && page > 0 ? page : 1;
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
        const total = await qb.getCount();
        const data = await qb
            .orderBy('recipe.created_at', 'DESC')
            .skip((safePage - 1) * safeLimit)
            .take(safeLimit)
            .getMany();
        return { data, total, page: safePage, limit: safeLimit };
    }
    async findRecipeById(id) {
        const recipe = await this.recipeRepository.findOne({
            where: { id },
            relations: ['category', 'recipe_products'],
        });
        if (!recipe)
            throw new common_1.NotFoundException('Rețeta nu a fost găsită');
        return recipe;
    }
    async updateRecipe(id, dto) {
        const recipe = await this.findRecipeById(id);
        if (dto.category_id && dto.category_id !== recipe.category_id) {
            const category = await this.categoryRepository.findOne({ where: { id: dto.category_id } });
            if (!category)
                throw new common_1.NotFoundException('Categoria nu a fost găsită');
        }
        Object.assign(recipe, dto);
        return await this.recipeRepository.save(recipe);
    }
    async deleteRecipe(id) {
        const recipe = await this.findRecipeById(id);
        await this.recipeRepository.remove(recipe);
    }
    async addProductToRecipe(dto) {
        const recipe = await this.recipeRepository.findOne({ where: { id: dto.recipe_id } });
        if (!recipe)
            throw new common_1.NotFoundException('Rețeta nu a fost găsită');
        const existing = await this.recipeProductRepository.findOne({ where: { recipe_id: dto.recipe_id, product_id: dto.product_id } });
        if (existing)
            throw new common_1.ConflictException('Produsul este deja adăugat în rețetă');
        const rp = this.recipeProductRepository.create(dto);
        return await this.recipeProductRepository.save(rp);
    }
    async findRecipeProducts(recipe_id) {
        return await this.recipeProductRepository.find({
            where: { recipe_id },
            order: { created_at: 'ASC' },
        });
    }
    async updateRecipeProduct(id, dto) {
        const rp = await this.recipeProductRepository.findOne({ where: { id } });
        if (!rp)
            throw new common_1.NotFoundException('Asocierea nu a fost găsită');
        Object.assign(rp, dto);
        return await this.recipeProductRepository.save(rp);
    }
    async removeProductFromRecipe(id) {
        const rp = await this.recipeProductRepository.findOne({ where: { id } });
        if (!rp)
            throw new common_1.NotFoundException('Asocierea nu a fost găsită');
        await this.recipeProductRepository.remove(rp);
    }
    async getRecipeStatistics() {
        const [totalRecipes, totalCategories] = await Promise.all([
            this.recipeRepository.count(),
            this.categoryRepository.count(),
        ]);
        return { totalRecipes, totalCategories };
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
        typeorm_2.Repository])
], RecipesService);
//# sourceMappingURL=recipes.service.js.map
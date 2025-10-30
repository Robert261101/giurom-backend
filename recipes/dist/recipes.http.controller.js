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
exports.RecipesHttpController = void 0;
const common_1 = require("@nestjs/common");
const recipes_service_1 = require("./recipes/recipes.service");
const recipes_media_service_1 = require("./recipes/recipes-media.service");
const recipes_preparations_service_1 = require("./recipes/recipes-preparations.service");
const recipes_labels_service_1 = require("./recipes/recipes-labels.service");
const create_recipe_dto_1 = require("./recipes/dto/create-recipe.dto");
const update_recipe_dto_1 = require("./recipes/dto/update-recipe.dto");
const create_recipe_category_dto_1 = require("./recipes/dto/create-recipe-category.dto");
const update_recipe_category_dto_1 = require("./recipes/dto/update-recipe-category.dto");
const create_recipe_product_dto_1 = require("./recipes/dto/create-recipe-product.dto");
const update_recipe_product_dto_1 = require("./recipes/dto/update-recipe-product.dto");
const create_recipe_media_dto_1 = require("./recipes/dto/create-recipe-media.dto");
const create_recipe_preparation_dto_1 = require("./recipes/dto/create-recipe-preparation.dto");
const update_recipe_preparation_dto_1 = require("./recipes/dto/update-recipe-preparation.dto");
const create_recipe_label_dto_1 = require("./recipes/dto/create-recipe-label.dto");
let RecipesHttpController = class RecipesHttpController {
    constructor(recipes, media, preps, labels) {
        this.recipes = recipes;
        this.media = media;
        this.preps = preps;
        this.labels = labels;
    }
    async findAll(q) {
        const page = Number.parseInt(q.page, 10);
        const limit = Number.parseInt(q.limit, 10);
        const maybeCid = q.category_id !== undefined ? Number(q.category_id) : undefined;
        const category_id = Number.isFinite(maybeCid) && maybeCid > 0 ? maybeCid : undefined;
        const result = await this.recipes.findAll({
            page: Number.isFinite(page) && page > 0 ? page : 1,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
            search: q.search,
            category_id
        });
        return {
            data: result.recipes,
            total: result.total,
            page: page || 1,
            limit: limit || 50
        };
    }
    create(dto) { return this.recipes.create(dto); }
    async categoriesFindAll(q) {
        const page = Number.parseInt(q.page, 10);
        const limit = Number.parseInt(q.limit, 10);
        const result = await this.recipes.findAllCategories({
            page: Number.isFinite(page) && page > 0 ? page : 1,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
            search: q.search
        });
        return {
            data: result.categories,
            total: result.total,
            page: page || 1,
            limit: limit || 50
        };
    }
    categoryFindOne(id) { return this.recipes.findOneCategory(Number(id)); }
    categoryCreate(dto) { return this.recipes.createCategory(dto); }
    categoryUpdate(id, dto) { return this.recipes.updateCategory(Number(id), dto); }
    categoryRemove(id) { return this.recipes.removeCategory(Number(id)); }
    addRecipeProduct(dto) { return this.recipes.addProductToRecipe(dto); }
    updateRecipeProduct(id, dto) { return this.recipes.updateRecipeProduct(Number(id), dto); }
    removeRecipeProduct(id) { return this.recipes.removeRecipeProduct(Number(id)); }
    getRecipeProducts(id) { return this.recipes.findRecipeProducts(Number(id)); }
    findOne(id) { return this.recipes.findOne(Number(id)); }
    update(id, dto) { return this.recipes.update(Number(id), dto); }
    remove(id) { return this.recipes.remove(Number(id)); }
    async uploadRecipeMedia(id, dto) {
        dto.recipe_id = Number(id);
        return this.media.createMedia(dto);
    }
    async getRecipeMedia(id) {
        return this.media.findMediaByRecipe(Number(id));
    }
    getPreparations(page = '1', limit = '50') { return this.preps.findAll(Number(page), Number(limit)); }
    getPreparation(id) { return this.preps.findOne(Number(id)); }
    createPreparation(dto) { return this.preps.create(dto); }
    updatePreparation(id, dto) {
        const payload = { ...dto };
        if (payload.produced_at && typeof payload.produced_at === 'string') {
            payload.produced_at = new Date(payload.produced_at);
        }
        return this.preps.update(Number(id), payload);
    }
    removePreparation(id) { return this.preps.remove(Number(id)); }
    prepareWithStock(dto) { return this.preps.prepareWithStock(dto); }
    labelsAll() { return this.labels.findAll(); }
    labelsOne(id) { return this.labels.findOne(Number(id)); }
    labelsCreate(dto) { return this.labels.create(dto); }
    labelsRemove(id) { return this.labels.remove(Number(id)); }
};
exports.RecipesHttpController = RecipesHttpController;
__decorate([
    (0, common_1.Get)('recipes'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('recipes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_dto_1.CreateRecipeDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('recipes/categories'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "categoriesFindAll", null);
__decorate([
    (0, common_1.Get)('recipes/categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryFindOne", null);
__decorate([
    (0, common_1.Post)('recipes/categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_category_dto_1.CreateRecipeCategoryDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryCreate", null);
__decorate([
    (0, common_1.Patch)('recipes/categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_category_dto_1.UpdateRecipeCategoryDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryUpdate", null);
__decorate([
    (0, common_1.Delete)('recipes/categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryRemove", null);
__decorate([
    (0, common_1.Post)('recipes/recipe-products'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_product_dto_1.CreateRecipeProductDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "addRecipeProduct", null);
__decorate([
    (0, common_1.Patch)('recipes/recipe-products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_product_dto_1.UpdateRecipeProductDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "updateRecipeProduct", null);
__decorate([
    (0, common_1.Delete)('recipes/recipe-products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "removeRecipeProduct", null);
__decorate([
    (0, common_1.Get)('recipes/:id/products'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getRecipeProducts", null);
__decorate([
    (0, common_1.Get)('recipes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('recipes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_dto_1.UpdateRecipeDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('recipes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('recipes/:id/media'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_recipe_media_dto_1.CreateRecipeMediaDto]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "uploadRecipeMedia", null);
__decorate([
    (0, common_1.Get)('recipes/:id/media'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "getRecipeMedia", null);
__decorate([
    (0, common_1.Get)('recipe-preparations'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getPreparations", null);
__decorate([
    (0, common_1.Get)('recipe-preparations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getPreparation", null);
__decorate([
    (0, common_1.Post)('recipe-preparations'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_preparation_dto_1.CreateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "createPreparation", null);
__decorate([
    (0, common_1.Patch)('recipe-preparations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_preparation_dto_1.UpdateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "updatePreparation", null);
__decorate([
    (0, common_1.Delete)('recipe-preparations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "removePreparation", null);
__decorate([
    (0, common_1.Post)('recipe-preparations/prepare-with-stock'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_preparation_dto_1.CreateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "prepareWithStock", null);
__decorate([
    (0, common_1.Get)('recipe-labels'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsAll", null);
__decorate([
    (0, common_1.Get)('recipe-labels/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsOne", null);
__decorate([
    (0, common_1.Post)('recipe-labels'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_label_dto_1.CreateRecipeLabelDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsCreate", null);
__decorate([
    (0, common_1.Delete)('recipe-labels/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsRemove", null);
exports.RecipesHttpController = RecipesHttpController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [recipes_service_1.RecipesService,
        recipes_media_service_1.RecipeMediaService,
        recipes_preparations_service_1.RecipePreparationsService,
        recipes_labels_service_1.RecipesLabelsService])
], RecipesHttpController);
//# sourceMappingURL=recipes.http.controller.js.map
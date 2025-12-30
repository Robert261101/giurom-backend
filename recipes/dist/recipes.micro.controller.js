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
exports.RecipesMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const recipes_service_1 = require("./recipes/recipes.service");
const recipes_media_service_1 = require("./recipes/recipes-media.service");
const recipes_preparations_service_1 = require("./recipes/recipes-preparations.service");
const recipes_labels_service_1 = require("./recipes/recipes-labels.service");
const create_recipe_dto_1 = require("./recipes/dto/create-recipe.dto");
const create_recipe_category_dto_1 = require("./recipes/dto/create-recipe-category.dto");
const create_recipe_product_dto_1 = require("./recipes/dto/create-recipe-product.dto");
const create_recipe_media_dto_1 = require("./recipes/dto/create-recipe-media.dto");
const create_recipe_preparation_dto_1 = require("./recipes/dto/create-recipe-preparation.dto");
let RecipesMicroController = class RecipesMicroController {
    constructor(service, mediaService, prepService, labelsService) {
        this.service = service;
        this.mediaService = mediaService;
        this.prepService = prepService;
        this.labelsService = labelsService;
    }
    createCategory(dto) {
        return this.service.createCategory(dto);
    }
    findAllCategories(payload) {
        return this.service.findAllCategories({
            page: payload.page || 1,
            limit: payload.limit || 10,
            search: payload.search
        });
    }
    findCategory(id) {
        return this.service.findOneCategory(id);
    }
    updateCategory(payload) {
        return this.service.updateCategory(payload.id, payload.dto);
    }
    deleteCategory(id) {
        return this.service.removeCategory(id);
    }
    create(dto) {
        return this.service.create(dto);
    }
    findAllRecipes(payload) {
        return this.service.findAll({
            page: payload.page || 1,
            limit: payload.limit || 10,
            search: payload.search,
            category_id: payload.category_id
        });
    }
    findOne(id) {
        return this.service.findOne(id);
    }
    update(payload) {
        return this.service.update(payload.id, payload.dto);
    }
    delete(id) {
        return this.service.remove(id);
    }
    addProduct(dto) {
        return this.service.addProductToRecipe(dto);
    }
    findRecipeProducts(recipe_id) {
        return this.service.findRecipeProducts(recipe_id);
    }
    updateRecipeProduct(payload) {
        return this.service.updateRecipeProduct(payload.id, payload.dto);
    }
    removeRecipeProduct(id) {
        return this.service.removeRecipeProduct(id);
    }
    createMedia(dto) {
        return this.mediaService.createMedia(dto);
    }
    findMediaByRecipe(recipe_id) {
        return this.mediaService.findMediaByRecipe(recipe_id);
    }
    statistics() {
        return this.service.getStatistics();
    }
    findAllPreps(payload) {
        return this.prepService.findAll(payload?.page || 1, payload?.limit || 50);
    }
    findOnePrep(id) { return this.prepService.findOne(id); }
    createPrep(dto) { return this.prepService.create(dto); }
    updatePrep(payload) {
        const dto = { ...payload.dto };
        if (dto.produced_at && typeof dto.produced_at === 'string') {
            dto.produced_at = new Date(dto.produced_at);
        }
        return this.prepService.update(payload.id, dto);
    }
    deletePrep(id) { return this.prepService.remove(id); }
    prepareWithStock(dto) { return this.prepService.prepareWithStock(dto); }
    labelsFindAll() { return this.labelsService.findAll(); }
    labelFindOne(id) { return this.labelsService.findOne(id); }
    labelCreate(payload) {
        if ('dto' in payload) {
            return this.labelsService.create(payload.dto, payload.user);
        }
        return this.labelsService.create(payload);
    }
    labelDelete(id) { return this.labelsService.remove(id); }
};
exports.RecipesMicroController = RecipesMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('recipes.categories.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_category_dto_1.CreateRecipeCategoryDto]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "createCategory", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.categories.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findAllCategories", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.categories.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findCategory", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.categories.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "updateCategory", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.categories.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "deleteCategory", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_dto_1.CreateRecipeDto]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "create", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findAllRecipes", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findOne", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "update", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "delete", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.products.add'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_product_dto_1.CreateRecipeProductDto]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "addProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.products.findByRecipe'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findRecipeProducts", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.products.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "updateRecipeProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.products.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "removeRecipeProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.media.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_media_dto_1.CreateRecipeMediaDto]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "createMedia", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.media.findByRecipe'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findMediaByRecipe", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipes.statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "statistics", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-preparations.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findAllPreps", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-preparations.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "findOnePrep", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-preparations.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_preparation_dto_1.CreateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "createPrep", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-preparations.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "updatePrep", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-preparations.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "deletePrep", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-preparations.prepareWithStock'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_preparation_dto_1.CreateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "prepareWithStock", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-labels.findAll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "labelsFindAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-labels.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "labelFindOne", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-labels.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "labelCreate", null);
__decorate([
    (0, microservices_1.MessagePattern)('recipe-labels.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RecipesMicroController.prototype, "labelDelete", null);
exports.RecipesMicroController = RecipesMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [recipes_service_1.RecipeService,
        recipes_media_service_1.RecipeMediaService,
        recipes_preparations_service_1.RecipePreparationsService,
        recipes_labels_service_1.RecipesLabelsService])
], RecipesMicroController);
//# sourceMappingURL=recipes.micro.controller.js.map
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
const permissions_decorator_1 = require("./permissions/permissions.decorator");
const recipes_service_1 = require("./recipes/recipes.service");
const recipes_media_service_1 = require("./recipes/recipes-media.service");
const recipes_preparations_service_1 = require("./recipes/recipes-preparations.service");
const recipes_labels_service_1 = require("./recipes/recipes-labels.service");
const recipes_printer_service_1 = require("./recipes/recipes-printer.service");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
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
const create_recipe_location_dto_1 = require("./recipes/dto/create-recipe-location.dto");
let RecipesHttpController = class RecipesHttpController {
    constructor(recipes, media, preps, labels, printer, httpService, configService) {
        this.recipes = recipes;
        this.media = media;
        this.preps = preps;
        this.labels = labels;
        this.printer = printer;
        this.httpService = httpService;
        this.configService = configService;
    }
    async findAll(q, req) {
        const page = Number.parseInt(q.page, 10);
        const limit = Number.parseInt(q.limit, 10);
        const maybeCid = q.category_id !== undefined ? Number(q.category_id) : undefined;
        const category_id = Number.isFinite(maybeCid) && maybeCid > 0 ? maybeCid : undefined;
        let location_id;
        const maybeLid = q.location_id !== undefined ? Number(q.location_id) : undefined;
        if (Number.isFinite(maybeLid) && maybeLid > 0) {
            location_id = maybeLid;
        }
        else {
            const user = req?.user;
            location_id = user?.work_location_id || user?.work_location_default_id;
        }
        if (!location_id) {
            throw new common_1.BadRequestException('Parametrul location_id este obligatoriu pentru a obține rețetele');
        }
        const result = await this.recipes.findAll({
            page: Number.isFinite(page) && page > 0 ? page : 1,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
            search: q.search,
            category_id,
            location_id
        });
        return {
            data: result.recipes,
            total: result.total,
            page: page || 1,
            totalPages: result.totalPages,
            limit: limit || 50
        };
    }
    create(dto, locationId, req) {
        let location_id;
        const maybeLid = locationId !== undefined ? Number(locationId) : undefined;
        if (Number.isFinite(maybeLid) && maybeLid > 0) {
            location_id = maybeLid;
        }
        else {
            const user = req?.user;
            location_id = user?.work_location_id || user?.work_location_default_id;
        }
        if (!location_id) {
            throw new common_1.BadRequestException('Nu se poate crea o rețetă fără o locație asignată. Vă rugăm să selectați o locație.');
        }
        return this.recipes.create(dto, location_id);
    }
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
            totalPages: result.totalPages,
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
    uploadMedia(id, dto) {
        return this.media.createMedia({ ...dto, recipe_id: Number(id) });
    }
    getRecipeMedia(id) {
        return this.media.findMediaByRecipe(Number(id));
    }
    async serveMedia(mediaId) {
        const mediaData = await this.media.serveMedia(Number(mediaId));
        return {
            data: mediaData.data,
            mimeType: mediaData.mimeType,
            fileName: mediaData.fileName
        };
    }
    deleteMedia(mediaId) {
        return this.media.removeMedia(Number(mediaId));
    }
    addRecipeIngredient(recipeId, body) {
        return this.recipes.addRecipeToRecipe(Number(recipeId), body.ingredient_recipe_id, body.quantity, body.notes);
    }
    getRecipeIngredients(id) { return this.recipes.getRecipeRecipes(Number(id)); }
    updateRecipeIngredient(id, body) {
        return this.recipes.updateRecipeRecipe(Number(id), body.quantity, body.notes);
    }
    removeRecipeIngredient(id) { return this.recipes.removeRecipeRecipe(Number(id)); }
    getScaledIngredientsWithStock(id, quantity) {
        const qty = Number(quantity) || 1000;
        return this.recipes.getScaledIngredientsWithStock(Number(id), qty);
    }
    findOne(id, locationId, req) {
        let location_id;
        const maybeLid = locationId !== undefined ? Number(locationId) : undefined;
        if (Number.isFinite(maybeLid) && maybeLid > 0) {
            location_id = maybeLid;
        }
        else {
            const user = req?.user;
            location_id = user?.work_location_id || user?.work_location_default_id;
        }
        if (!location_id) {
            throw new common_1.BadRequestException('Nu se poate accesa o rețetă fără o locație asignată. Vă rugăm să selectați o locație.');
        }
        return this.recipes.findOne(Number(id), location_id);
    }
    update(id, dto, locationId, req) {
        let location_id;
        const maybeLid = locationId !== undefined ? Number(locationId) : undefined;
        if (Number.isFinite(maybeLid) && maybeLid > 0) {
            location_id = maybeLid;
        }
        else {
            const user = req?.user;
            location_id = user?.work_location_id || user?.work_location_default_id;
        }
        return this.recipes.update(Number(id), dto, location_id);
    }
    remove(id) { return this.recipes.remove(Number(id)); }
    getPreparations(page = '1', limit = '50', locationId, req) {
        const user = req?.user;
        const hasRecipesRead = user?.permissions?.includes('recipes.read');
        if (!hasRecipesRead) {
            let finalLocationId = locationId ? parseInt(locationId, 10) : undefined;
            if (!finalLocationId) {
                finalLocationId = user?.work_location_id || user?.work_location_default_id;
            }
            if (!finalLocationId) {
                return [];
            }
            return this.preps.findAll(Number(page), Number(limit), finalLocationId);
        }
        return this.preps.findAll(Number(page), Number(limit), locationId ? parseInt(locationId, 10) : undefined);
    }
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
    labelsCreate(dto, req) {
        return this.labels.create(dto, req.user);
    }
    labelsRemove(id) { return this.labels.remove(Number(id)); }
    async printLabel(id, body) {
        const label = await this.labels.findOne(Number(id));
        if (!label) {
            throw new common_1.NotFoundException('Eticheta nu a fost găsită');
        }
        const prep = await this.preps.findOne(label.recipe_preparation_id);
        if (!prep) {
            throw new common_1.NotFoundException('Preparatul nu a fost găsit');
        }
        const recipe = prep.recipe;
        const copies = body.copies || 1;
        const baseDate = prep.produced_at || label.generated_at;
        const expirationHours = recipe?.expiration_hours || 48;
        const expirationDate = new Date(new Date(baseDate).getTime() + expirationHours * 60 * 60 * 1000);
        let generatedBy = 'Necunoscut';
        const employeeId = label.generated_by_employee_id || prep.produced_by;
        if (employeeId) {
            try {
                const employeesServiceUrl = this.configService.get('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
                const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                const headers = {
                    'Content-Type': 'application/json',
                    'x-internal-service': 'recipes',
                    'x-service-secret': serviceSecret
                };
                const employeeResponse = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${employeesServiceUrl}/employees/${employeeId}`, { headers }));
                const employeeData = employeeResponse?.data?.data || employeeResponse?.data || employeeResponse;
                if (employeeData) {
                    if (employeeData.name) {
                        generatedBy = employeeData.name;
                    }
                    else if (employeeData.first_name && employeeData.last_name) {
                        generatedBy = `${employeeData.first_name} ${employeeData.last_name}`;
                    }
                    else {
                        generatedBy = `Angajat ID: ${employeeId}`;
                    }
                }
            }
            catch (error) {
                if (error?.response?.status !== 404) {
                    console.warn(`⚠️ [RECIPES CONTROLLER] Could not fetch employee ${employeeId}:`, error?.message);
                }
                generatedBy = `Angajat ID: ${employeeId}`;
            }
        }
        const printData = {
            codEticheta: label.label_code,
            preparatNume: recipe?.name ? `${recipe.name} - ${prep.quantity || 0}g` : 'Preparat necunoscut',
            retetaNume: recipe?.name || 'Rețetă necunoscută',
            dataCrearii: prep.produced_at?.toISOString() || label.generated_at.toISOString(),
            dataExpirarii: expirationDate.toISOString(),
            generataDe: generatedBy,
        };
        try {
            await this.printer.printLabel(printData, copies);
            return { success: true, message: `Eticheta a fost trimisă la imprimantă (${copies} copie/copii)` };
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : 'Eroare necunoscută la printare');
        }
    }
    async testPrinter() {
        const isConnected = await this.printer.testConnection();
        if (!isConnected) {
            const foundPort = await this.printer.findPrinterPort();
            if (foundPort) {
                return {
                    success: false,
                    message: `Portul configurat nu funcționează, dar am găsit portul ${foundPort} care este deschis. Actualizează PRINTER_PORT=${foundPort} în variabilele de mediu.`,
                    foundPort: foundPort
                };
            }
        }
        return {
            success: isConnected,
            message: isConnected ? 'Conexiunea la imprimantă este funcțională' : 'Nu s-a putut conecta la imprimantă. Verifică IP-ul și portul.'
        };
    }
    async assignRecipeToLocation(assignDto) {
        return this.recipes.assignRecipeToLocation(assignDto);
    }
    async getRecipeLocations(recipeId) {
        return this.recipes.findRecipeLocations(Number(recipeId));
    }
    async removeRecipeFromLocation(recipeId, locationId) {
        await this.recipes.removeRecipeFromLocation(Number(recipeId), Number(locationId));
        return { message: 'Rețeta a fost eliminată de la locație cu succes' };
    }
};
exports.RecipesHttpController = RecipesHttpController;
__decorate([
    (0, common_1.Get)('recipes'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('recipes'),
    (0, permissions_decorator_1.Permissions)('recipes.create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('location_id')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_dto_1.CreateRecipeDto, String, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('recipes/categories'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "categoriesFindAll", null);
__decorate([
    (0, common_1.Get)('recipes/categories/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryFindOne", null);
__decorate([
    (0, common_1.Post)('recipes/categories'),
    (0, permissions_decorator_1.Permissions)('recipes.create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_category_dto_1.CreateRecipeCategoryDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryCreate", null);
__decorate([
    (0, common_1.Patch)('recipes/categories/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_category_dto_1.UpdateRecipeCategoryDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryUpdate", null);
__decorate([
    (0, common_1.Delete)('recipes/categories/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "categoryRemove", null);
__decorate([
    (0, common_1.Post)('recipes/recipe-products'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_product_dto_1.CreateRecipeProductDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "addRecipeProduct", null);
__decorate([
    (0, common_1.Patch)('recipes/recipe-products/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_product_dto_1.UpdateRecipeProductDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "updateRecipeProduct", null);
__decorate([
    (0, common_1.Delete)('recipes/recipe-products/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "removeRecipeProduct", null);
__decorate([
    (0, common_1.Get)('recipes/:id/products'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getRecipeProducts", null);
__decorate([
    (0, common_1.Post)('recipes/:id/media'),
    (0, permissions_decorator_1.Permissions)('recipes.create'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_recipe_media_dto_1.CreateRecipeMediaDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "uploadMedia", null);
__decorate([
    (0, common_1.Get)('recipes/:id/media'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getRecipeMedia", null);
__decorate([
    (0, common_1.Get)('recipes/media/:mediaId'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "serveMedia", null);
__decorate([
    (0, common_1.Delete)('recipes/media/:mediaId'),
    (0, permissions_decorator_1.Permissions)('recipes.delete'),
    __param(0, (0, common_1.Param)('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "deleteMedia", null);
__decorate([
    (0, common_1.Post)('recipes/:id/recipe-ingredients'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "addRecipeIngredient", null);
__decorate([
    (0, common_1.Get)('recipes/:id/recipe-ingredients'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getRecipeIngredients", null);
__decorate([
    (0, common_1.Patch)('recipes/recipe-ingredients/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "updateRecipeIngredient", null);
__decorate([
    (0, common_1.Delete)('recipes/recipe-ingredients/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "removeRecipeIngredient", null);
__decorate([
    (0, common_1.Get)('recipes/:id/scaled-ingredients-with-stock'),
    (0, permissions_decorator_1.Permissions)('preparation.create'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('quantity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getScaledIngredientsWithStock", null);
__decorate([
    (0, common_1.Get)('recipes/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('location_id')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('recipes/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('location_id')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_dto_1.UpdateRecipeDto, String, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('recipes/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('recipe-preparations'),
    (0, permissions_decorator_1.Permissions)('preparation.read'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('location_id')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getPreparations", null);
__decorate([
    (0, common_1.Get)('recipe-preparations/:id'),
    (0, permissions_decorator_1.Permissions)('preparation.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "getPreparation", null);
__decorate([
    (0, common_1.Post)('recipe-preparations'),
    (0, permissions_decorator_1.Permissions)('preparation.create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_preparation_dto_1.CreateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "createPreparation", null);
__decorate([
    (0, common_1.Patch)('recipe-preparations/:id'),
    (0, permissions_decorator_1.Permissions)('preparation.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_recipe_preparation_dto_1.UpdateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "updatePreparation", null);
__decorate([
    (0, common_1.Delete)('recipe-preparations/:id'),
    (0, permissions_decorator_1.Permissions)('preparation.delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "removePreparation", null);
__decorate([
    (0, common_1.Post)('recipe-preparations/prepare-with-stock'),
    (0, permissions_decorator_1.Permissions)('preparation.create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_preparation_dto_1.CreateRecipePreparationDto]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "prepareWithStock", null);
__decorate([
    (0, common_1.Get)('recipe-labels'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsAll", null);
__decorate([
    (0, common_1.Get)('recipe-labels/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsOne", null);
__decorate([
    (0, common_1.Post)('recipe-labels'),
    (0, permissions_decorator_1.Permissions)('recipes.create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_label_dto_1.CreateRecipeLabelDto, Object]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsCreate", null);
__decorate([
    (0, common_1.Delete)('recipe-labels/:id'),
    (0, permissions_decorator_1.Permissions)('recipes.delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RecipesHttpController.prototype, "labelsRemove", null);
__decorate([
    (0, common_1.Post)('recipe-labels/:id/print'),
    (0, permissions_decorator_1.Permissions)('recipes.create'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "printLabel", null);
__decorate([
    (0, common_1.Post)('recipe-labels/test-printer'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "testPrinter", null);
__decorate([
    (0, common_1.Post)('recipes/locations/assign'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recipe_location_dto_1.CreateRecipeLocationDto]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "assignRecipeToLocation", null);
__decorate([
    (0, common_1.Get)('recipes/:recipeId/locations'),
    (0, permissions_decorator_1.Permissions)('recipes.read'),
    __param(0, (0, common_1.Param)('recipeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "getRecipeLocations", null);
__decorate([
    (0, common_1.Delete)('recipes/:recipeId/locations/:locationId'),
    (0, permissions_decorator_1.Permissions)('recipes.update'),
    __param(0, (0, common_1.Param)('recipeId')),
    __param(1, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RecipesHttpController.prototype, "removeRecipeFromLocation", null);
exports.RecipesHttpController = RecipesHttpController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [recipes_service_1.RecipeService,
        recipes_media_service_1.RecipeMediaService,
        recipes_preparations_service_1.RecipePreparationsService,
        recipes_labels_service_1.RecipesLabelsService,
        recipes_printer_service_1.RecipesPrinterService,
        axios_1.HttpService,
        config_1.ConfigService])
], RecipesHttpController);
//# sourceMappingURL=recipes.http.controller.js.map
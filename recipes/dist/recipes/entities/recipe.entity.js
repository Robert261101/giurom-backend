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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Recipe = void 0;
const typeorm_1 = require("typeorm");
const recipe_category_entity_1 = require("./recipe-category.entity");
const recipe_product_entity_1 = require("./recipe-product.entity");
const recipe_preparation_entity_1 = require("./recipe-preparation.entity");
const recipe_media_entity_1 = require("./recipe-media.entity");
let Recipe = class Recipe {
};
exports.Recipe = Recipe;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Recipe.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Recipe.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Recipe.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Recipe.prototype, "category_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Recipe.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Recipe.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 24 }),
    __metadata("design:type", Number)
], Recipe.prototype, "expiration_hours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], Recipe.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", Object)
], Recipe.prototype, "video_link", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => recipe_category_entity_1.RecipeCategory, (category) => category.recipes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'category_id' }),
    __metadata("design:type", recipe_category_entity_1.RecipeCategory)
], Recipe.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => recipe_product_entity_1.RecipeProduct, (rp) => rp.recipe, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], Recipe.prototype, "recipe_products", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => recipe_preparation_entity_1.RecipePreparation, (rp) => rp.recipe, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], Recipe.prototype, "recipe_preparations", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => recipe_media_entity_1.RecipeMedia, (media) => media.recipe, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], Recipe.prototype, "recipeMedia", void 0);
exports.Recipe = Recipe = __decorate([
    (0, typeorm_1.Entity)('recipes')
], Recipe);
//# sourceMappingURL=recipe.entity.js.map
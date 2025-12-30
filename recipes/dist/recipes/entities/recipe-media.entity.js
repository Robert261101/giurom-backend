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
exports.RecipeMedia = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const recipe_entity_1 = require("./recipe.entity");
let RecipeMedia = class RecipeMedia {
};
exports.RecipeMedia = RecipeMedia;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al fișierului media',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RecipeMedia.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul rețetei',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RecipeMedia.prototype, "recipe_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele fișierului',
        example: 'recipe_step_1.jpg',
        maxLength: 255,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], RecipeMedia.prototype, "file_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul fișierului',
        example: 'image/jpeg',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], RecipeMedia.prototype, "file_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Link-ul către fișier',
        example: '/files/recipes/1/recipe_step_1.jpg',
        maxLength: 255,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], RecipeMedia.prototype, "file_link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], RecipeMedia.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Rețeta asociată cu acest fișier media',
        type: () => recipe_entity_1.Recipe,
    }),
    (0, typeorm_1.ManyToOne)(() => recipe_entity_1.Recipe, recipe => recipe.recipeMedia),
    (0, typeorm_1.JoinColumn)({ name: 'recipe_id' }),
    __metadata("design:type", recipe_entity_1.Recipe)
], RecipeMedia.prototype, "recipe", void 0);
exports.RecipeMedia = RecipeMedia = __decorate([
    (0, typeorm_1.Entity)('recipe_media')
], RecipeMedia);
//# sourceMappingURL=recipe-media.entity.js.map
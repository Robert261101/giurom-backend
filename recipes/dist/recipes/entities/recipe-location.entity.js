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
exports.RecipeLocation = void 0;
const typeorm_1 = require("typeorm");
const recipe_entity_1 = require("./recipe.entity");
let RecipeLocation = class RecipeLocation {
};
exports.RecipeLocation = RecipeLocation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RecipeLocation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipe_id' }),
    __metadata("design:type", Number)
], RecipeLocation.prototype, "recipeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'id_location' }),
    __metadata("design:type", Number)
], RecipeLocation.prototype, "idLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_consumable', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RecipeLocation.prototype, "isConsumable", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], RecipeLocation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], RecipeLocation.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => recipe_entity_1.Recipe, (recipe) => recipe.recipeLocations, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'recipe_id' }),
    __metadata("design:type", recipe_entity_1.Recipe)
], RecipeLocation.prototype, "recipe", void 0);
exports.RecipeLocation = RecipeLocation = __decorate([
    (0, typeorm_1.Entity)('recipe_locations')
], RecipeLocation);
//# sourceMappingURL=recipe-location.entity.js.map
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
exports.RecipePreparation = void 0;
const typeorm_1 = require("typeorm");
const recipe_entity_1 = require("./recipe.entity");
const recipe_label_entity_1 = require("./recipe-label.entity");
let RecipePreparation = class RecipePreparation {
};
exports.RecipePreparation = RecipePreparation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RecipePreparation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RecipePreparation.prototype, "recipe_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'produced_by', nullable: true }),
    __metadata("design:type", Number)
], RecipePreparation.prototype, "produced_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], RecipePreparation.prototype, "location_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], RecipePreparation.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], RecipePreparation.prototype, "produced_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RecipePreparation.prototype, "is_labeled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RecipePreparation.prototype, "is_consumable", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], RecipePreparation.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], RecipePreparation.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => recipe_entity_1.Recipe, (recipe) => recipe.recipe_preparations, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'recipe_id' }),
    __metadata("design:type", recipe_entity_1.Recipe)
], RecipePreparation.prototype, "recipe", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => recipe_label_entity_1.RecipeLabel, (label) => label.preparation),
    __metadata("design:type", Array)
], RecipePreparation.prototype, "labels", void 0);
exports.RecipePreparation = RecipePreparation = __decorate([
    (0, typeorm_1.Entity)('recipe_preparations')
], RecipePreparation);
//# sourceMappingURL=recipe-preparation.entity.js.map
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
exports.RecipeLabel = void 0;
const typeorm_1 = require("typeorm");
const recipe_preparation_entity_1 = require("./recipe-preparation.entity");
let RecipeLabel = class RecipeLabel {
};
exports.RecipeLabel = RecipeLabel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RecipeLabel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RecipeLabel.prototype, "recipe_preparation_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true }),
    __metadata("design:type", String)
], RecipeLabel.prototype, "label_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], RecipeLabel.prototype, "label_file_path", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], RecipeLabel.prototype, "generated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => recipe_preparation_entity_1.RecipePreparation, (prep) => prep.labels, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'recipe_preparation_id' }),
    __metadata("design:type", recipe_preparation_entity_1.RecipePreparation)
], RecipeLabel.prototype, "preparation", void 0);
exports.RecipeLabel = RecipeLabel = __decorate([
    (0, typeorm_1.Entity)('recipe_labels')
], RecipeLabel);
//# sourceMappingURL=recipe-label.entity.js.map
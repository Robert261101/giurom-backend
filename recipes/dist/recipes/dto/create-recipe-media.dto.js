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
exports.CreateRecipeMediaDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateRecipeMediaDto {
}
exports.CreateRecipeMediaDto = CreateRecipeMediaDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul rețetei',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateRecipeMediaDto.prototype, "recipe_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele fișierului',
        example: 'recipe_step_1.jpg',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecipeMediaDto.prototype, "file_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul fișierului',
        example: 'image/jpeg',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecipeMediaDto.prototype, "file_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Link-ul către fișier',
        example: '/files/recipes/1/recipe_step_1.jpg',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecipeMediaDto.prototype, "file_link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Conținutul fișierului în format base64 sau data URL',
        example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDA...',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecipeMediaDto.prototype, "file_content", void 0);
//# sourceMappingURL=create-recipe-media.dto.js.map
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
exports.CreateWasteRecordDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateWasteRecordDto {
}
exports.CreateWasteRecordDto = CreateWasteRecordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the product that was wasted' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateWasteRecordDto.prototype, "product_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Location ID reference (no FK)', required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateWasteRecordDto.prototype, "location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the recipe (if waste occurred during recipe preparation)', required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateWasteRecordDto.prototype, "recipe_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantity of product wasted' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateWasteRecordDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unit of measurement for the wasted quantity' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWasteRecordDto.prototype, "unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Reason for waste', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWasteRecordDto.prototype, "reason", void 0);
//# sourceMappingURL=create-waste-record.dto.js.map
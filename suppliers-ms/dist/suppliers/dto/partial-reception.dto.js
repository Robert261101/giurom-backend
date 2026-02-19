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
exports.PartialReceptionDto = exports.PartialReceptionItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class PartialReceptionItemDto {
}
exports.PartialReceptionItemDto = PartialReceptionItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul item-ului din comandă' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PartialReceptionItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cantitatea recepționată' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PartialReceptionItemDto.prototype, "receivedQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cantitatea returnată (opțional)', required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PartialReceptionItemDto.prototype, "returnedQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Motivul returnării (opțional)', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PartialReceptionItemDto.prototype, "returnReason", void 0);
class PartialReceptionDto {
}
exports.PartialReceptionDto = PartialReceptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul comenzii' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PartialReceptionDto.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de item-uri recepționate',
        type: [PartialReceptionItemDto]
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PartialReceptionItemDto),
    __metadata("design:type", Array)
], PartialReceptionDto.prototype, "items", void 0);
//# sourceMappingURL=partial-reception.dto.js.map
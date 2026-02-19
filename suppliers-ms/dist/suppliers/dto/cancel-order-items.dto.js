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
exports.CancelOrderItemsDto = exports.CancelOrderItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CancelOrderItemDto {
}
exports.CancelOrderItemDto = CancelOrderItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul item-ului din comandă (supplier_order_item_id)' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CancelOrderItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cantitatea de anulat (returned_quantity) - maxim cât mai rămâne de recepționat' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CancelOrderItemDto.prototype, "returnedQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Motivul anulării (opțional)', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CancelOrderItemDto.prototype, "returnReason", void 0);
class CancelOrderItemsDto {
}
exports.CancelOrderItemsDto = CancelOrderItemsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul comenzii' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CancelOrderItemsDto.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de item-uri de anulat',
        type: [CancelOrderItemDto]
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CancelOrderItemDto),
    __metadata("design:type", Array)
], CancelOrderItemsDto.prototype, "items", void 0);
//# sourceMappingURL=cancel-order-items.dto.js.map
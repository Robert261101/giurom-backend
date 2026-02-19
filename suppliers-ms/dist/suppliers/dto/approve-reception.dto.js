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
exports.RejectReceptionDto = exports.ApproveReceptionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ApproveReceptionDto {
}
exports.ApproveReceptionDto = ApproveReceptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul comenzii' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ApproveReceptionDto.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de ID-uri ale recepțiilor de aprobat',
        type: [Number]
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], ApproveReceptionDto.prototype, "receptionIds", void 0);
class RejectReceptionDto {
}
exports.RejectReceptionDto = RejectReceptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul comenzii' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RejectReceptionDto.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de ID-uri ale recepțiilor de respins',
        type: [Number]
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], RejectReceptionDto.prototype, "receptionIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Motivul respingerii (opțional)',
        required: false
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RejectReceptionDto.prototype, "reason", void 0);
//# sourceMappingURL=approve-reception.dto.js.map
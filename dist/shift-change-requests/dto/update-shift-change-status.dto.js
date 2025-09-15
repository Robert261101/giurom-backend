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
exports.UpdateShiftChangeStatusDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const shift_change_request_entity_1 = require("../entities/shift-change-request.entity");
class UpdateShiftChangeStatusDto {
}
exports.UpdateShiftChangeStatusDto = UpdateShiftChangeStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Noul status al cererii',
        enum: shift_change_request_entity_1.ShiftChangeStatus,
        example: shift_change_request_entity_1.ShiftChangeStatus.APPROVED
    }),
    (0, class_validator_1.IsEnum)(shift_change_request_entity_1.ShiftChangeStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Statusul este obligatoriu' }),
    __metadata("design:type", String)
], UpdateShiftChangeStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID manager care aprobă/respinge cererea',
        example: 3
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'reviewed_by_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'reviewed_by_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], UpdateShiftChangeStatusDto.prototype, "reviewed_by_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Comentariu despre decizia luată',
        example: 'Cererea a fost aprobată, înlocuitorul este disponibil',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Comentariul trebuie să fie un string' }),
    __metadata("design:type", String)
], UpdateShiftChangeStatusDto.prototype, "review_comment", void 0);
//# sourceMappingURL=update-shift-change-status.dto.js.map
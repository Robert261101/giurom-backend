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
exports.FilterShiftChangeRequestsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const shift_change_request_entity_1 = require("../entities/shift-change-request.entity");
class FilterShiftChangeRequestsDto {
}
exports.FilterShiftChangeRequestsDto = FilterShiftChangeRequestsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul cererii pentru filtrare',
        enum: shift_change_request_entity_1.ShiftChangeStatus,
        example: shift_change_request_entity_1.ShiftChangeStatus.PENDING,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shift_change_request_entity_1.ShiftChangeStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' }),
    __metadata("design:type", String)
], FilterShiftChangeRequestsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID angajat care cere schimbul pentru filtrare',
        example: 1,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'employee_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'employee_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], FilterShiftChangeRequestsDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID angajat înlocuitor pentru filtrare',
        example: 2,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'replacement_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'replacement_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], FilterShiftChangeRequestsDto.prototype, "replacement_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data de început pentru filtrare',
        example: '2024-08-01T00:00:00Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], FilterShiftChangeRequestsDto.prototype, "start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data de sfârșit pentru filtrare',
        example: '2024-08-31T23:59:59Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], FilterShiftChangeRequestsDto.prototype, "end_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID manager care a aprobat/respins pentru filtrare',
        example: 3,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'reviewed_by_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'reviewed_by_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], FilterShiftChangeRequestsDto.prototype, "reviewed_by_id", void 0);
//# sourceMappingURL=filter-shift-change-requests.dto.js.map
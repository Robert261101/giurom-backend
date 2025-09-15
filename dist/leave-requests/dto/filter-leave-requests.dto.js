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
exports.FilterLeaveRequestsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const leave_request_entity_1 = require("../entities/leave-request.entity");
class FilterLeaveRequestsDto {
}
exports.FilterLeaveRequestsDto = FilterLeaveRequestsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul cererii pentru filtrare',
        enum: leave_request_entity_1.LeaveStatus,
        example: leave_request_entity_1.LeaveStatus.PENDING,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(leave_request_entity_1.LeaveStatus, { message: 'Statusul trebuie să fie pending, approved sau rejected' }),
    __metadata("design:type", String)
], FilterLeaveRequestsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID angajat pentru filtrare',
        example: 1,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'employee_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'employee_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], FilterLeaveRequestsDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul concediului pentru filtrare',
        example: 'Concediu de odihnă',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Tipul concediului trebuie să fie un string' }),
    __metadata("design:type", String)
], FilterLeaveRequestsDto.prototype, "leave_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data de început pentru filtrare',
        example: '2024-08-01T00:00:00Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], FilterLeaveRequestsDto.prototype, "start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data de sfârșit pentru filtrare',
        example: '2024-08-31T23:59:59Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], FilterLeaveRequestsDto.prototype, "end_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID manager care a aprobat/respins pentru filtrare',
        example: 2,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'reviewed_by_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'reviewed_by_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], FilterLeaveRequestsDto.prototype, "reviewed_by_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unitatea de durată pentru filtrare',
        enum: leave_request_entity_1.DurationUnit,
        example: leave_request_entity_1.DurationUnit.DAYS,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(leave_request_entity_1.DurationUnit, { message: 'Unitatea de durată trebuie să fie days sau hours' }),
    __metadata("design:type", String)
], FilterLeaveRequestsDto.prototype, "duration_unit", void 0);
//# sourceMappingURL=filter-leave-requests.dto.js.map
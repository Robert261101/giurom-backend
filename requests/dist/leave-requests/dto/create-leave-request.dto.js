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
exports.CreateLeaveRequestDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const leave_request_entity_1 = require("../entities/leave-request.entity");
class CreateLeaveRequestDto {
}
exports.CreateLeaveRequestDto = CreateLeaveRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat care face cererea', example: 1 }),
    (0, class_validator_1.IsNumber)({}, { message: 'employee_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'employee_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateLeaveRequestDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul concediului',
        example: 'Concediu de odihnă',
        maxLength: 100
    }),
    (0, class_validator_1.IsString)({ message: 'Tipul concediului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tipul concediului este obligatoriu' }),
    (0, class_validator_1.Length)(2, 100, { message: 'Tipul concediului trebuie să aibă între 2 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "leave_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a concediului',
        example: '2024-08-01T00:00:00Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a concediului',
        example: '2024-08-05T23:59:59Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Comentariul/motivul cererii',
        example: 'Concediu planificat pentru vacanța de vară',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Comentariul trebuie să fie un string' }),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unitatea de măsură pentru durată',
        enum: leave_request_entity_1.DurationUnit,
        example: leave_request_entity_1.DurationUnit.DAYS,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(leave_request_entity_1.DurationUnit, { message: 'Unitatea de durată trebuie să fie days sau hours' }),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "duration_unit", void 0);
//# sourceMappingURL=create-leave-request.dto.js.map
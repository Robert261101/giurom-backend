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
exports.CreateShiftChangeRequestDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateShiftChangeRequestDto {
}
exports.CreateShiftChangeRequestDto = CreateShiftChangeRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat care cere schimbul', example: 1 }),
    (0, class_validator_1.IsNumber)({}, { message: 'employee_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'employee_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateShiftChangeRequestDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat propus ca înlocuitor', example: 2 }),
    (0, class_validator_1.IsNumber)({}, { message: 'replacement_id trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'replacement_id trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateShiftChangeRequestDto.prototype, "replacement_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a schimbului',
        example: '2024-08-01T08:00:00Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateShiftChangeRequestDto.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a schimbului',
        example: '2024-08-01T16:00:00Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateShiftChangeRequestDto.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Comentariul/motivul cererii de schimb',
        example: 'Am o urgență medicală și nu pot lucra în această tură',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Comentariul trebuie să fie un string' }),
    __metadata("design:type", String)
], CreateShiftChangeRequestDto.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unitatea de durată', enum: ['days', 'hours'], required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['days', 'hours'], { message: 'Unitatea de durată trebuie să fie days sau hours' }),
    __metadata("design:type", String)
], CreateShiftChangeRequestDto.prototype, "duration_unit", void 0);
//# sourceMappingURL=create-shift-change-request.dto.js.map
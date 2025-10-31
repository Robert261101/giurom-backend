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
exports.CreateShiftDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateShiftDto {
}
exports.CreateShiftDto = CreateShiftDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul angajatului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul angajatului este obligatoriu' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul angajatului trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateShiftDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației de lucru',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul locației de lucru trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul locației de lucru este obligatoriu' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul locației de lucru trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateShiftDto.prototype, "work_location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul departamentului',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul departamentului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul departamentului este obligatoriu' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul departamentului trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateShiftDto.prototype, "department_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul poziției în departament',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul poziției trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul poziției trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateShiftDto.prototype, "position_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a schimbului',
        example: '2024-01-15T08:00:00Z',
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie o dată validă în format ISO' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Data de început este obligatorie' }),
    __metadata("design:type", String)
], CreateShiftDto.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a schimbului',
        example: '2024-01-15T16:00:00Z',
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie o dată validă în format ISO' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Data de sfârșit este obligatorie' }),
    __metadata("design:type", String)
], CreateShiftDto.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre schimbul de lucru',
        example: 'Schimb de dimineață cu responsabilități speciale',
        required: false,
    }),
    (0, class_validator_1.IsString)({ message: 'Notele trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreateShiftDto.prototype, "notes", void 0);
//# sourceMappingURL=create-shift.dto.js.map
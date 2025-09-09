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
exports.CreateWorkLocationDepartmentsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateWorkLocationDepartmentsDto {
}
exports.CreateWorkLocationDepartmentsDto = CreateWorkLocationDepartmentsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numele departamentului', example: 'Departamentul IT', maxLength: 50 }),
    (0, class_validator_1.IsString)({ message: 'Numele departamentului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numele departamentului este obligatoriu' }),
    (0, class_validator_1.Length)(2, 50, { message: 'Numele departamentului trebuie să aibă între 2 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDepartmentsDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Codul departamentului', example: 'IT001', maxLength: 20 }),
    (0, class_validator_1.IsString)({ message: 'Codul departamentului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Codul departamentului este obligatoriu' }),
    (0, class_validator_1.Length)(2, 20, { message: 'Codul departamentului trebuie să aibă între 2 și 20 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDepartmentsDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Descrierea departamentului', example: 'Departament responsabil pentru infrastructura IT', required: false }),
    (0, class_validator_1.IsString)({ message: 'Descrierea trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Descrierea nu poate depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDepartmentsDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul locației de lucru', example: 1 }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul locației trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul locației este obligatoriu' }),
    __metadata("design:type", Number)
], CreateWorkLocationDepartmentsDto.prototype, "work_location_id", void 0);
//# sourceMappingURL=create-work-location-departments.dto.js.map
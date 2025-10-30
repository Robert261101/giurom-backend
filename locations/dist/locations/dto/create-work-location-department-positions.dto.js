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
exports.CreateWorkLocationDepartmentPositionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateWorkLocationDepartmentPositionsDto {
}
exports.CreateWorkLocationDepartmentPositionsDto = CreateWorkLocationDepartmentPositionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numele poziției', example: 'Dezvoltator Software Senior', maxLength: 50 }),
    (0, class_validator_1.IsString)({ message: 'Numele poziției trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numele poziției este obligatoriu' }),
    (0, class_validator_1.Length)(2, 50, { message: 'Numele poziției trebuie să aibă între 2 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDepartmentPositionsDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Codul poziției', example: 'DEV_SR_001', maxLength: 50 }),
    (0, class_validator_1.IsString)({ message: 'Codul poziției trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Codul poziției este obligatoriu' }),
    (0, class_validator_1.Length)(2, 50, { message: 'Codul poziției trebuie să aibă între 2 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDepartmentPositionsDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Descrierea poziției', example: 'Responsabil pentru dezvoltarea aplicațiilor web', required: false }),
    (0, class_validator_1.IsString)({ message: 'Descrierea trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Descrierea nu poate depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDepartmentPositionsDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul departamentului', example: 1 }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul departamentului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul departamentului este obligatoriu' }),
    __metadata("design:type", Number)
], CreateWorkLocationDepartmentPositionsDto.prototype, "department_id", void 0);
//# sourceMappingURL=create-work-location-department-positions.dto.js.map
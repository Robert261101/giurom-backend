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
exports.CreateTaskTemplateAssignmentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateTaskTemplateAssignmentDto {
    constructor() {
        this.template_id = 1;
        this.active = true;
    }
}
exports.CreateTaskTemplateAssignmentDto = CreateTaskTemplateAssignmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul locației de lucru', example: 1 }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul locației trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul locației este obligatoriu' }),
    __metadata("design:type", Number)
], CreateTaskTemplateAssignmentDto.prototype, "location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul template-ului de sarcină', example: 1, default: 1, required: false }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul template-ului trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateTaskTemplateAssignmentDto.prototype, "template_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data când a fost atribuit template-ul la locație', example: '2023-12-15T10:30:00Z', required: false }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data atribuirii trebuie să fie o dată validă' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTaskTemplateAssignmentDto.prototype, "assigned_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Indică dacă template-ul este activ pentru această locație', example: true, default: true, required: false }),
    (0, class_validator_1.IsBoolean)({ message: 'Statusul activ trebuie să fie boolean' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateTaskTemplateAssignmentDto.prototype, "active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Note despre atribuirea template-ului', example: 'Template atribuit pentru echipa de dimineață', required: false }),
    (0, class_validator_1.IsString)({ message: 'Notele trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreateTaskTemplateAssignmentDto.prototype, "notes", void 0);
//# sourceMappingURL=create-task-template-assignment.dto.js.map
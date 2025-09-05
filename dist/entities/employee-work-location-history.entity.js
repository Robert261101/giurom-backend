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
exports.EmployeeWorkLocationHistory = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const employee_entity_1 = require("./employee.entity");
let EmployeeWorkLocationHistory = class EmployeeWorkLocationHistory {
};
exports.EmployeeWorkLocationHistory = EmployeeWorkLocationHistory;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al înregistrării din istoric',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EmployeeWorkLocationHistory.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EmployeeWorkLocationHistory.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației de lucru',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EmployeeWorkLocationHistory.prototype, "work_location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descrierea mutării sau schimbării',
        example: 'Transferat de la sediul central la filiala Cluj',
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], EmployeeWorkLocationHistory.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data creării înregistrării',
        example: '2023-12-01T10:00:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], EmployeeWorkLocationHistory.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], EmployeeWorkLocationHistory.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Angajatul asociat cu acest istoric',
        type: () => employee_entity_1.Employee,
    }),
    (0, typeorm_1.ManyToOne)(() => employee_entity_1.Employee, employee => employee.workLocationHistory),
    (0, typeorm_1.JoinColumn)({ name: 'employee_id' }),
    __metadata("design:type", employee_entity_1.Employee)
], EmployeeWorkLocationHistory.prototype, "employee", void 0);
exports.EmployeeWorkLocationHistory = EmployeeWorkLocationHistory = __decorate([
    (0, typeorm_1.Entity)('employee_work_location_history')
], EmployeeWorkLocationHistory);
//# sourceMappingURL=employee-work-location-history.entity.js.map
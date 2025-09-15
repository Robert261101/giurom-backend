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
exports.EmployeeLocation = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const employee_entity_1 = require("./employee.entity");
let EmployeeLocation = class EmployeeLocation {
};
exports.EmployeeLocation = EmployeeLocation;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al înregistrării',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EmployeeLocation.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, typeorm_1.Column)({ name: 'employee_id' }),
    __metadata("design:type", Number)
], EmployeeLocation.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației',
        example: 1,
    }),
    (0, typeorm_1.Column)({ name: 'id_location' }),
    __metadata("design:type", Number)
], EmployeeLocation.prototype, "id_location", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data creării înregistrării',
        example: '2023-12-01T10:00:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], EmployeeLocation.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'datetime' }),
    __metadata("design:type", Date)
], EmployeeLocation.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Angajatul asociat cu această locație',
        type: () => employee_entity_1.Employee,
    }),
    (0, typeorm_1.ManyToOne)(() => employee_entity_1.Employee, employee => employee.employeeLocations),
    (0, typeorm_1.JoinColumn)({ name: 'employee_id' }),
    __metadata("design:type", employee_entity_1.Employee)
], EmployeeLocation.prototype, "employee", void 0);
exports.EmployeeLocation = EmployeeLocation = __decorate([
    (0, typeorm_1.Entity)('Employees_Locations')
], EmployeeLocation);
//# sourceMappingURL=employee-location.entity.js.map
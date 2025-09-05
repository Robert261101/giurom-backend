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
exports.EmployeeFiles = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const employee_entity_1 = require("./employee.entity");
let EmployeeFiles = class EmployeeFiles {
};
exports.EmployeeFiles = EmployeeFiles;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al fișierului',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EmployeeFiles.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EmployeeFiles.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele fișierului',
        example: 'CV_Ion_Popescu.pdf',
        maxLength: 255,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], EmployeeFiles.prototype, "file_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul fișierului',
        example: 'pdf',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], EmployeeFiles.prototype, "file_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Link-ul către fișier',
        example: '/files/employees/1/document.pdf',
        maxLength: 255,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], EmployeeFiles.prototype, "file_link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], EmployeeFiles.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Angajatul asociat cu acest fișier',
        type: () => employee_entity_1.Employee,
    }),
    (0, typeorm_1.ManyToOne)(() => employee_entity_1.Employee, employee => employee.employeeFiles),
    (0, typeorm_1.JoinColumn)({ name: 'employee_id' }),
    __metadata("design:type", employee_entity_1.Employee)
], EmployeeFiles.prototype, "employee", void 0);
exports.EmployeeFiles = EmployeeFiles = __decorate([
    (0, typeorm_1.Entity)('employee_files')
], EmployeeFiles);
//# sourceMappingURL=employee-files.entity.js.map
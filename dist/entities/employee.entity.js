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
exports.Employee = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const employee_work_location_history_entity_1 = require("./employee-work-location-history.entity");
const employee_files_entity_1 = require("./employee-files.entity");
const generated_documents_entity_1 = require("./generated-documents.entity");
let Employee = class Employee {
};
exports.Employee = Employee;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al angajatului',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Employee.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prenumele angajatului',
        example: 'Ion',
        maxLength: 50,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Employee.prototype, "first_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele de familie al angajatului',
        example: 'Popescu',
        maxLength: 50,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Employee.prototype, "last_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Adresa de email a angajatului',
        example: 'ion.popescu@giurom.ro',
        maxLength: 50,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Employee.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numărul de telefon al angajatului',
        example: '+40712345678',
        maxLength: 20,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Employee.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numărul personal (CNP)',
        example: '1234567890123',
        maxLength: 15,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 15,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        nullable: true,
        select: false,
    }),
    __metadata("design:type", String)
], Employee.prototype, "personal_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data nașterii',
        example: '1990-05-15',
    }),
    (0, typeorm_1.Column)('date', { nullable: true }),
    __metadata("design:type", Date)
], Employee.prototype, "birth_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Genul angajatului',
        example: 'male',
        enum: ['male', 'female', 'other'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['male', 'female', 'other'],
        nullable: true,
    }),
    __metadata("design:type", String)
], Employee.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Starea civilă',
        example: 'single',
        enum: ['single', 'married', 'other'],
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['single', 'married', 'other'],
        nullable: true
    }),
    __metadata("design:type", String)
], Employee.prototype, "marital_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Naționalitatea angajatului',
        example: 'Română',
        maxLength: 50,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Employee.prototype, "nationality", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Adresa completă a angajatului',
        example: 'Str. Exemplu nr. 123, București',
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Employee.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data angajării',
        example: '2023-01-15',
    }),
    (0, typeorm_1.Column)('date', { nullable: true }),
    __metadata("design:type", Date)
], Employee.prototype, "hire_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data încetării contractului',
        example: '2025-01-15',
        required: false,
    }),
    (0, typeorm_1.Column)('date', { nullable: true }),
    __metadata("design:type", Date)
], Employee.prototype, "termination_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul poziției implicite',
        example: 1,
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Employee.prototype, "position_default_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul departamentului implicit',
        example: 1,
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Employee.prototype, "department_default_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației de lucru implicite',
        example: 1,
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Employee.prototype, "work_location_default_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul contractului',
        example: 'permanent',
        enum: ['permanent', 'fixed-term', 'internship'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['permanent', 'fixed-term', 'internship'],
        nullable: true,
    }),
    __metadata("design:type", String)
], Employee.prototype, "contract_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indică dacă angajatul este activ',
        example: true,
        default: true,
    }),
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Employee.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data creării înregistrării',
        example: '2023-12-01T10:00:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Employee.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Employee.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Istoricul locațiilor de lucru ale angajatului',
        type: () => [employee_work_location_history_entity_1.EmployeeWorkLocationHistory],
    }),
    (0, typeorm_1.OneToMany)(() => employee_work_location_history_entity_1.EmployeeWorkLocationHistory, history => history.employee),
    __metadata("design:type", Array)
], Employee.prototype, "workLocationHistory", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fișierele angajatului',
        type: () => [employee_files_entity_1.EmployeeFiles],
    }),
    (0, typeorm_1.OneToMany)(() => employee_files_entity_1.EmployeeFiles, file => file.employee),
    __metadata("design:type", Array)
], Employee.prototype, "employeeFiles", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Documentele generate pentru angajat',
        type: () => [generated_documents_entity_1.GeneratedDocuments],
    }),
    (0, typeorm_1.OneToMany)(() => generated_documents_entity_1.GeneratedDocuments, document => document.employee),
    __metadata("design:type", Array)
], Employee.prototype, "generatedDocuments", void 0);
exports.Employee = Employee = __decorate([
    (0, typeorm_1.Entity)('employees')
], Employee);
//# sourceMappingURL=employee.entity.js.map
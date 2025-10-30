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
let Employee = class Employee {
    get full_name() {
        return `${this.first_name} ${this.last_name}`;
    }
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
        description: 'Data angajării',
        example: '2023-01-15',
    }),
    (0, typeorm_1.Column)('date'),
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
        description: 'Tipul contractului',
        example: 'permanent',
        enum: ['permanent', 'fixed-term', 'internship'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['permanent', 'fixed-term', 'internship']
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
exports.Employee = Employee = __decorate([
    (0, typeorm_1.Entity)('employees')
], Employee);
//# sourceMappingURL=employee.entity.js.map
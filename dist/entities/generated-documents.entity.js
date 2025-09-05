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
exports.GeneratedDocuments = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const employee_entity_1 = require("./employee.entity");
let GeneratedDocuments = class GeneratedDocuments {
};
exports.GeneratedDocuments = GeneratedDocuments;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al documentului generat',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GeneratedDocuments.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], GeneratedDocuments.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul documentului template',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], GeneratedDocuments.prototype, "doc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul documentului',
        example: 'completed',
        maxLength: 50,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], GeneratedDocuments.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data semnării documentului',
        example: '2023-12-15T10:30:00Z',
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], GeneratedDocuments.prototype, "signed_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data expirării documentului',
        example: '2024-12-15',
    }),
    (0, typeorm_1.Column)('date'),
    __metadata("design:type", Date)
], GeneratedDocuments.prototype, "expired_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Angajatul asociat cu acest document',
        type: () => employee_entity_1.Employee,
    }),
    (0, typeorm_1.ManyToOne)(() => employee_entity_1.Employee, employee => employee.generatedDocuments),
    (0, typeorm_1.JoinColumn)({ name: 'employee_id' }),
    __metadata("design:type", employee_entity_1.Employee)
], GeneratedDocuments.prototype, "employee", void 0);
exports.GeneratedDocuments = GeneratedDocuments = __decorate([
    (0, typeorm_1.Entity)('generated_documents')
], GeneratedDocuments);
//# sourceMappingURL=generated-documents.entity.js.map
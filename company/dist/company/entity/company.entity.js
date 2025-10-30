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
exports.Company = void 0;
const typeorm_1 = require("typeorm");
const company_document_entity_1 = require("./company-document.entity");
let Company = class Company {
};
exports.Company = Company;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Company.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "company_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "cui", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "trade_register_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: 'Romania', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "county", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "postal_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: 'Romania', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "phone_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)('date'),
    __metadata("design:type", Date)
], Company.prototype, "incorporation_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "legal_form", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "activity_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Company.prototype, "vat_payer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "bank_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 34, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "bank_account_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'activ', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], Company.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Company.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Company.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => company_document_entity_1.CompanyDocument, (document) => document.company, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], Company.prototype, "documents", void 0);
exports.Company = Company = __decorate([
    (0, typeorm_1.Entity)('companies')
], Company);
//# sourceMappingURL=company.entity.js.map
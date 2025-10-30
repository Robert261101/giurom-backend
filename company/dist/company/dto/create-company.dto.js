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
exports.CreateCompanyDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateCompanyDto {
    constructor() {
        this.county = 'Romania';
        this.country = 'Romania';
        this.vat_payer = false;
        this.status = 'activ';
    }
}
exports.CreateCompanyDto = CreateCompanyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numele companiei', example: 'SC Giurom SRL', maxLength: 255 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(2, 255),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "company_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Codul Unic de Înregistrare (CUI)', example: 'RO12345678', maxLength: 20 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^RO\d{2,18}$/),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "cui", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numărul de înregistrare din registrul comerțului', example: 'J40/1234/2023', maxLength: 50 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(5, 50),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "trade_register_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Adresa completă a companiei', example: 'Str. Exemplu nr. 123, Sector 1' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(10, 500),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Orașul', example: 'București', maxLength: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Județ', example: 'București', maxLength: 100, default: 'Romania' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "county", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cod poștal', example: '010101', maxLength: 20, required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{6}$/),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "postal_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Țara', example: 'Romania', maxLength: 100, default: 'Romania' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Telefon', example: '+40712345678', maxLength: 20, required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\+40\d{9}$/),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "phone_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Email', example: 'contact@giurom.com', maxLength: 255, required: false }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(5, 255),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data înregistrării', example: '2023-01-15' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "incorporation_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Forma juridică', example: 'SRL', enum: ['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA'] }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsIn)(['SRL', 'SA', 'PFA', 'II', 'IF', 'ONG', 'COOPERATIVA']),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "legal_form", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'CAEN', example: '6201', maxLength: 10 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^\d{4}$/),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "activity_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'TVA', example: false, default: false, required: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateCompanyDto.prototype, "vat_payer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Banca', example: 'BCR', maxLength: 255, required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(2, 255),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "bank_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'IBAN', example: 'RO49AAAA1B31007593840000', maxLength: 34, required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^RO\d{2}[A-Z]{4}\d{16}$/),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "bank_account_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Website', example: 'https://www.giurom.com', maxLength: 255, required: false }),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(5, 255),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "website", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Status', example: 'activ', enum: ['activ', 'inactiv', 'suspendat'], default: 'activ', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['activ', 'inactiv', 'suspendat']),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Note', example: 'Companie nou înregistrată', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "notes", void 0);
//# sourceMappingURL=create-company.dto.js.map
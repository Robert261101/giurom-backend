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
exports.CreateCompanyWithDocumentsDto = exports.CreateCompanyDocumentUploadDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const create_company_dto_1 = require("./create-company.dto");
class CreateCompanyDocumentUploadDto {
}
exports.CreateCompanyDocumentUploadDto = CreateCompanyDocumentUploadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numele fișierului', example: 'certificat.pdf' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "fileName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numele fișierului (alternativ)', example: 'certificat.pdf' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul documentului (opțional)', example: 'abc123' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Tipul documentului', example: 'Certificat de înmatriculare' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "document_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Nota pentru document', example: 'Document original scanat', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Note alternative', example: 'Document important', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Conținutul fișierului în format base64', example: 'data:application/pdf;base64,JVBERi0...', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Tipul MIME al fișierului', example: 'application/pdf', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCompanyDocumentUploadDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Dimensiunea fișierului în bytes', example: 245678, required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateCompanyDocumentUploadDto.prototype, "size", void 0);
class CreateCompanyWithDocumentsDto extends create_company_dto_1.CreateCompanyDto {
}
exports.CreateCompanyWithDocumentsDto = CreateCompanyWithDocumentsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Lista de documente pentru încărcare', type: [CreateCompanyDocumentUploadDto], required: false }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateCompanyDocumentUploadDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateCompanyWithDocumentsDto.prototype, "documents", void 0);
//# sourceMappingURL=create-company-with-documents.dto.js.map
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
exports.CreateWorkLocationFileDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateWorkLocationFileDto {
}
exports.CreateWorkLocationFileDto = CreateWorkLocationFileDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul locației trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul locației este obligatoriu' }),
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    __metadata("design:type", Number)
], CreateWorkLocationFileDto.prototype, "work_location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele fișierului',
        example: 'Contract_Locatie_2023.pdf',
        maxLength: 255,
    }),
    (0, class_validator_1.IsString)({ message: 'Numele fișierului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numele fișierului este obligatoriu' }),
    (0, class_validator_1.Length)(3, 255, { message: 'Numele fișierului trebuie să aibă între 3 și 255 de caractere' }),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9._\-\săîâșțĂÎÂȘȚ]+\.(pdf|doc|docx|jpg|jpeg|png|txt|xlsx|xls)$/i, {
        message: 'Numele fișierului trebuie să aibă o extensie validă (.pdf, .doc, .docx, .jpg, .jpeg, .png, .txt, .xlsx, .xls)'
    }),
    __metadata("design:type", String)
], CreateWorkLocationFileDto.prototype, "file_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul fișierului',
        example: 'Contract',
        maxLength: 100,
        enum: ['Contract', 'Autorizatie', 'Certificat', 'Poza', 'Plan', 'Document_Financiar', 'Altele'],
    }),
    (0, class_validator_1.IsString)({ message: 'Tipul fișierului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tipul fișierului este obligatoriu' }),
    (0, class_validator_1.Length)(2, 100, { message: 'Tipul fișierului trebuie să aibă între 2 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationFileDto.prototype, "file_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Link-ul către fișier sau calea de stocare',
        example: '/files/locations/1/contract_locatie.pdf',
        maxLength: 255,
    }),
    (0, class_validator_1.IsString)({ message: 'Link-ul fișierului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Link-ul fișierului este obligatoriu' }),
    (0, class_validator_1.Length)(5, 255, { message: 'Link-ul fișierului trebuie să aibă între 5 și 255 de caractere' }),
    (0, class_validator_1.Matches)(/^(\/storage\/|\/files\/|https?:\/\/|\\\\server\\)/, {
        message: 'Link-ul trebuie să înceapă cu /storage/, /files/, http://, https:// sau \\\\server\\'
    }),
    __metadata("design:type", String)
], CreateWorkLocationFileDto.prototype, "file_link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Conținutul fișierului în format base64 (opțional)',
        example: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo...',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Conținutul fișierului trebuie să fie un string' }),
    __metadata("design:type", String)
], CreateWorkLocationFileDto.prototype, "file_content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data expirării documentului',
        example: '2023-12-31T23:59:59Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Data expirării trebuie să fie un string' }),
    __metadata("design:type", String)
], CreateWorkLocationFileDto.prototype, "expire_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul folderului (opțional)',
        example: 1,
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul folderului trebuie să fie un număr' }),
    (0, class_transformer_1.Transform)(({ value }) => (value != null ? parseInt(value, 10) : undefined)),
    __metadata("design:type", Number)
], CreateWorkLocationFileDto.prototype, "folder_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre fișier (poate include informații despre folder etc.)',
        example: '|folder:Contract de Închiriere locație| Document încărcat la 15.11.2023',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Notele trebuie să fie un string' }),
    (0, class_validator_1.Length)(0, 1000, { message: 'Notele trebuie să aibă între 0 și 1000 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationFileDto.prototype, "notes", void 0);
//# sourceMappingURL=create-work-location-file.dto.js.map
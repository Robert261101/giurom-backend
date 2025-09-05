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
exports.CreateEmployeeFileDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateEmployeeFileDto {
}
exports.CreateEmployeeFileDto = CreateEmployeeFileDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul angajatului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul angajatului este obligatoriu' }),
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    __metadata("design:type", Number)
], CreateEmployeeFileDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele fișierului',
        example: 'CV_Ion_Popescu_2023.pdf',
        maxLength: 255,
    }),
    (0, class_validator_1.IsString)({ message: 'Numele fișierului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numele fișierului este obligatoriu' }),
    (0, class_validator_1.Length)(3, 255, { message: 'Numele fișierului trebuie să aibă între 3 și 255 de caractere' }),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9._\-\săîâșțĂÎÂȘȚ]+\.(pdf|doc|docx|jpg|jpeg|png|txt|xlsx|xls)$/i, {
        message: 'Numele fișierului trebuie să aibă o extensie validă (.pdf, .doc, .docx, .jpg, .jpeg, .png, .txt, .xlsx, .xls)'
    }),
    __metadata("design:type", String)
], CreateEmployeeFileDto.prototype, "file_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul fișierului',
        example: 'CV',
        maxLength: 100,
        enum: ['CV', 'Contract', 'Act_Identitate', 'Diploma', 'Certificat', 'Poza', 'Document_Medical', 'Altele'],
    }),
    (0, class_validator_1.IsString)({ message: 'Tipul fișierului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tipul fișierului este obligatoriu' }),
    (0, class_validator_1.Length)(2, 100, { message: 'Tipul fișierului trebuie să aibă între 2 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateEmployeeFileDto.prototype, "file_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Link-ul către fișier sau calea de stocare',
        example: '/files/employees/1/cv_ion_popescu.pdf',
        maxLength: 255,
    }),
    (0, class_validator_1.IsString)({ message: 'Link-ul fișierului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Link-ul fișierului este obligatoriu' }),
    (0, class_validator_1.Length)(5, 255, { message: 'Link-ul fișierului trebuie să aibă între 5 și 255 de caractere' }),
    (0, class_validator_1.Matches)(/^(\/storage\/|\/files\/|https?:\/\/|\\\\server\\)/, {
        message: 'Link-ul trebuie să înceapă cu /storage/, /files/, http://, https:// sau \\\\server\\'
    }),
    __metadata("design:type", String)
], CreateEmployeeFileDto.prototype, "file_link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Conținutul fișierului în format base64 (opțional)',
        example: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo...',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Conținutul fișierului trebuie să fie un string' }),
    __metadata("design:type", String)
], CreateEmployeeFileDto.prototype, "file_content", void 0);
//# sourceMappingURL=create-employee-file.dto.js.map
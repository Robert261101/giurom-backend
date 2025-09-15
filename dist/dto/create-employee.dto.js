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
exports.CreateEmployeeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateEmployeeDto {
    constructor() {
        this.is_active = true;
    }
}
exports.CreateEmployeeDto = CreateEmployeeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prenumele angajatului',
        example: 'Ion',
        maxLength: 50,
    }),
    (0, class_validator_1.IsString)({ message: 'Prenumele trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Prenumele este obligatoriu' }),
    (0, class_validator_1.Length)(2, 50, { message: 'Prenumele trebuie să aibă între 2 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "first_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele de familie al angajatului',
        example: 'Popescu',
        maxLength: 50,
    }),
    (0, class_validator_1.IsString)({ message: 'Numele de familie trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numele de familie este obligatoriu' }),
    (0, class_validator_1.Length)(2, 50, { message: 'Numele de familie trebuie să aibă între 2 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "last_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Adresa de email a angajatului',
        example: 'ion.popescu@giurom.ro',
        maxLength: 50,
    }),
    (0, class_validator_1.IsEmail)({}, { message: 'Adresa de email nu este validă' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Email-ul este obligatoriu' }),
    (0, class_validator_1.Length)(5, 50, { message: 'Email-ul trebuie să aibă între 5 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numărul de telefon al angajatului',
        example: '+40712345678',
        maxLength: 20,
    }),
    (0, class_validator_1.IsString)({ message: 'Numărul de telefon trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numărul de telefon este obligatoriu' }),
    (0, class_validator_1.Matches)(/^\+40\d{9}$/, { message: 'Numărul de telefon trebuie să aibă formatul +40xxxxxxxxx' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numărul personal (CNP)',
        example: '1900515123456',
        maxLength: 15,
    }),
    (0, class_validator_1.IsString)({ message: 'Numărul personal trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numărul personal este obligatoriu' }),
    (0, class_validator_1.Matches)(/^\d{13}$/, { message: 'Numărul personal trebuie să conțină exact 13 cifre' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "personal_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data nașterii',
        example: '1990-05-15',
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data nașterii trebuie să fie o dată validă (YYYY-MM-DD)' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Data nașterii este obligatorie' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "birth_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Genul angajatului',
        example: 'male',
        enum: ['male', 'female', 'other'],
    }),
    (0, class_validator_1.IsString)({ message: 'Genul trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Genul este obligatoriu' }),
    (0, class_validator_1.IsIn)(['male', 'female', 'other'], {
        message: 'Genul trebuie să fie unul din: male, female, other',
    }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Starea civilă',
        example: 'single',
        enum: ['single', 'married', 'other'],
        required: false,
    }),
    (0, class_validator_1.IsString)({ message: 'Starea civilă trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['single', 'married', 'other'], {
        message: 'Starea civilă trebuie să fie una din: single, married, other',
    }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "marital_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Naționalitatea angajatului',
        example: 'Română',
        maxLength: 50,
    }),
    (0, class_validator_1.IsString)({ message: 'Naționalitatea trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Naționalitatea este obligatorie' }),
    (0, class_validator_1.Length)(2, 50, { message: 'Naționalitatea trebuie să aibă între 2 și 50 de caractere' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "nationality", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Adresa completă a angajatului',
        example: 'Str. Exemplu nr. 123, București',
    }),
    (0, class_validator_1.IsString)({ message: 'Adresa trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Adresa este obligatorie' }),
    (0, class_validator_1.Length)(10, 500, { message: 'Adresa trebuie să aibă între 10 și 500 de caractere' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data angajării',
        example: '2023-01-15',
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data angajării trebuie să fie o dată validă (YYYY-MM-DD)' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Data angajării este obligatorie' }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "hire_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data încetării contractului',
        example: '2025-01-15',
        required: false,
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data încetării trebuie să fie o dată validă (YYYY-MM-DD)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "termination_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul poziției implicite',
        example: 1,
        required: false,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul poziției trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateEmployeeDto.prototype, "position_default_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul departamentului implicit',
        example: 1,
        required: false,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul departamentului trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateEmployeeDto.prototype, "department_default_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației de lucru implicite',
        example: 1,
        required: false,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul locației de lucru trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateEmployeeDto.prototype, "work_location_default_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul contractului',
        example: 'permanent',
        enum: ['permanent', 'fixed-term', 'internship'],
    }),
    (0, class_validator_1.IsString)({ message: 'Tipul contractului trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tipul contractului este obligatoriu' }),
    (0, class_validator_1.IsIn)(['permanent', 'fixed-term', 'internship'], {
        message: 'Tipul contractului trebuie să fie unul din: permanent, fixed-term, internship',
    }),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "contract_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indică dacă angajatul este activ',
        example: true,
        default: true,
        required: false,
    }),
    (0, class_validator_1.IsBoolean)({ message: 'Statusul activ trebuie să fie boolean' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateEmployeeDto.prototype, "is_active", void 0);
//# sourceMappingURL=create-employee.dto.js.map
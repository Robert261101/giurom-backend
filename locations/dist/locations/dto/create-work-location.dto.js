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
exports.CreateWorkLocationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateWorkLocationDto {
    constructor() {
        this.country = 'Romania';
        this.employee_id = 1;
        this.points = 0;
    }
}
exports.CreateWorkLocationDto = CreateWorkLocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul companiei la care aparține locația', example: 1 }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul companiei trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul companiei este obligatoriu' }),
    __metadata("design:type", Number)
], CreateWorkLocationDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numele locației de lucru', example: 'Sediul Central București', maxLength: 255 }),
    (0, class_validator_1.IsString)({ message: 'Numele locației trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Numele locației este obligatoriu' }),
    (0, class_validator_1.Length)(3, 255, { message: 'Numele locației trebuie să aibă între 3 și 255 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "location_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Adresa completă a locației', example: 'Str. Exemplu nr. 123, Sector 1, București' }),
    (0, class_validator_1.IsString)({ message: 'Adresa trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Adresa este obligatorie' }),
    (0, class_validator_1.Length)(10, 500, { message: 'Adresa trebuie să aibă între 10 și 500 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Orașul în care se află locația', example: 'București', maxLength: 100 }),
    (0, class_validator_1.IsString)({ message: 'Orașul trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Orașul este obligatoriu' }),
    (0, class_validator_1.Length)(2, 100, { message: 'Orașul trebuie să aibă între 2 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Județul în care se află locația', example: 'București', maxLength: 100 }),
    (0, class_validator_1.IsString)({ message: 'Județul trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Județul este obligatoriu' }),
    (0, class_validator_1.Length)(2, 100, { message: 'Județul trebuie să aibă între 2 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "county", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Codul poștal al locației', example: '010101', maxLength: 20, required: false }),
    (0, class_validator_1.IsString)({ message: 'Codul poștal trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, { message: 'Codul poștal trebuie să conțină 6 cifre' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "postal_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Țara în care se află locația', example: 'Romania', maxLength: 100, default: 'Romania' }),
    (0, class_validator_1.IsString)({ message: 'Țara trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(2, 100, { message: 'Țara trebuie să aibă între 2 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numărul de telefon al locației', example: '+40212345678', maxLength: 20, required: false }),
    (0, class_validator_1.IsString)({ message: 'Numărul de telefon trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\+40\d{9}$/, { message: 'Numărul de telefon trebuie să aibă formatul +40xxxxxxxxx' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "phone_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Adresa de email pentru locația respectivă', example: 'bucuresti@giurom.com', maxLength: 255, required: false }),
    (0, class_validator_1.IsEmail)({}, { message: 'Adresa de email nu este validă' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(5, 255, { message: 'Email-ul trebuie să aibă între 5 și 255 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID-ul angajatului responsabil pentru locație', example: 1, default: 1, required: false }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul angajatului trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateWorkLocationDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Note despre locația de lucru', example: 'Sediul principal cu 50 de angajați', required: false }),
    (0, class_validator_1.IsString)({ message: 'Notele trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Latitudinea GPS a locației', example: 44.4268, required: false }),
    (0, class_validator_1.IsNumber)({}, { message: 'Latitudinea GPS trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(-90, { message: 'Latitudinea trebuie să fie între -90 și 90' }),
    (0, class_validator_1.Max)(90, { message: 'Latitudinea trebuie să fie între -90 și 90' }),
    __metadata("design:type", Number)
], CreateWorkLocationDto.prototype, "gps_lat", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Longitudinea GPS a locației', example: 26.1025, required: false }),
    (0, class_validator_1.IsNumber)({}, { message: 'Longitudinea GPS trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(-180, { message: 'Longitudinea trebuie să fie între -180 și 180' }),
    (0, class_validator_1.Max)(180, { message: 'Longitudinea trebuie să fie între -180 și 180' }),
    __metadata("design:type", Number)
], CreateWorkLocationDto.prototype, "gps_lng", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Raza GPS în metri pentru geofencing', example: 50, required: false }),
    (0, class_validator_1.IsNumber)({}, { message: 'Raza GPS trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(1, { message: 'Raza GPS trebuie să fie cel puțin 1 metru' }),
    (0, class_validator_1.Max)(10000, { message: 'Raza GPS nu poate depăși 10000 metri' }),
    __metadata("design:type", Number)
], CreateWorkLocationDto.prototype, "gps_radius_m", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Punctajul locației pentru BI', example: 10, required: false, default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'Punctajul trebuie să fie un număr întreg' }),
    __metadata("design:type", Number)
], CreateWorkLocationDto.prototype, "points", void 0);
//# sourceMappingURL=create-work-location.dto.js.map
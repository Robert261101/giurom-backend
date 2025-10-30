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
exports.CreateCalendarEventDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateCalendarEventDto {
}
exports.CreateCalendarEventDto = CreateCalendarEventDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Titlul evenimentului',
        example: 'Ședință echipă',
        maxLength: 100
    }),
    (0, class_validator_1.IsString)({ message: 'Titlul trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Titlul este obligatoriu' }),
    (0, class_validator_1.Length)(1, 100, { message: 'Titlul trebuie să aibă între 1 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateCalendarEventDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Categoria evenimentului',
        example: 'Întâlniri',
        maxLength: 100
    }),
    (0, class_validator_1.IsString)({ message: 'Categoria trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Categoria este obligatorie' }),
    (0, class_validator_1.Length)(1, 100, { message: 'Categoria trebuie să aibă între 1 și 100 de caractere' }),
    __metadata("design:type", String)
], CreateCalendarEventDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început',
        example: '2024-07-25T09:00:00Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateCalendarEventDto.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit',
        example: '2024-07-25T10:00:00Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateCalendarEventDto.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Durata în minute',
        example: 60,
        minimum: 1
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'Durata trebuie să fie un număr' }),
    (0, class_validator_1.Min)(1, { message: 'Durata trebuie să fie cel puțin 1 minut' }),
    __metadata("design:type", Number)
], CreateCalendarEventDto.prototype, "duration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descrierea evenimentului',
        example: 'Discutăm despre progresul proiectelor și planurile pentru săptămâna viitoare',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Descrierea trebuie să fie un string' }),
    __metadata("design:type", String)
], CreateCalendarEventDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID regula de recurență',
        example: 1,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul regulii de recurență trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul regulii de recurență trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateCalendarEventDto.prototype, "recurrence_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID angajat care creează evenimentul',
        example: 1
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul creatorului trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul creatorului trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreateCalendarEventDto.prototype, "created_by", void 0);
//# sourceMappingURL=create-calendar-event.dto.js.map
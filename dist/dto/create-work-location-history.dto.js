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
exports.CreateWorkLocationHistoryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateWorkLocationHistoryDto {
}
exports.CreateWorkLocationHistoryDto = CreateWorkLocationHistoryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul angajatului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul angajatului este obligatoriu' }),
    __metadata("design:type", Number)
], CreateWorkLocationHistoryDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației de lucru',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul locației de lucru trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul locației de lucru este obligatoriu' }),
    __metadata("design:type", Number)
], CreateWorkLocationHistoryDto.prototype, "work_location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descrierea mutării sau schimbării',
        example: 'Transferat de la sediul central la filiala Cluj pentru proiectul de dezvoltare software',
        maxLength: 1000,
    }),
    (0, class_validator_1.IsString)({ message: 'Descrierea trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Descrierea este obligatorie' }),
    (0, class_validator_1.Length)(10, 1000, { message: 'Descrierea trebuie să aibă între 10 și 1000 de caractere' }),
    __metadata("design:type", String)
], CreateWorkLocationHistoryDto.prototype, "description", void 0);
//# sourceMappingURL=create-work-location-history.dto.js.map
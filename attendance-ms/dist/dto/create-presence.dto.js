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
exports.CreatePresenceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const presence_entity_1 = require("../entities/presence.entity");
class CreatePresenceDto {
}
exports.CreatePresenceDto = CreatePresenceDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul schimbului de lucru',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul schimbului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul schimbului este obligatoriu' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul schimbului trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreatePresenceDto.prototype, "shift_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data pentru care se înregistrează prezența',
        example: '2024-01-15',
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data trebuie să fie o dată validă în format ISO (YYYY-MM-DD)' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Data este obligatorie' }),
    __metadata("design:type", String)
], CreatePresenceDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul prezenței angajatului',
        enum: presence_entity_1.PresenceStatus,
        example: presence_entity_1.PresenceStatus.PRESENT_FULL,
    }),
    (0, class_validator_1.IsEnum)(presence_entity_1.PresenceStatus, { message: 'Statusul trebuie să fie unul dintre: present_full, present_partial, absent' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Statusul este obligatoriu' }),
    __metadata("design:type", String)
], CreatePresenceDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Ora de check-in',
        example: '2024-01-15T08:00:00Z',
        required: false,
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Ora de check-in trebuie să fie o dată validă în format ISO' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePresenceDto.prototype, "check_in", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Ora de check-out',
        example: '2024-01-15T16:00:00Z',
        required: false,
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Ora de check-out trebuie să fie o dată validă în format ISO' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePresenceDto.prototype, "check_out", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Totalul orelor lucrate',
        example: 8.5,
        required: false,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'Totalul orelor trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(0, { message: 'Totalul orelor nu poate fi negativ' }),
    (0, class_validator_1.Max)(24, { message: 'Totalul orelor nu poate depăși 24' }),
    __metadata("design:type", Number)
], CreatePresenceDto.prototype, "total_hours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Flag GPS pentru ieșirea din zona permisă',
        example: false,
        required: false,
    }),
    (0, class_validator_1.IsBoolean)({ message: 'Flag-ul GPS trebuie să fie true sau false' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreatePresenceDto.prototype, "gps_exit_flag", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre prezența angajatului',
        example: 'A ieșit mai devreme din motive medicale',
        required: false,
    }),
    (0, class_validator_1.IsString)({ message: 'Notele trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreatePresenceDto.prototype, "notes", void 0);
//# sourceMappingURL=create-presence.dto.js.map
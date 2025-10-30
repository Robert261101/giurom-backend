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
exports.CreatePresenceInflexionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const presence_inflexion_entity_1 = require("../entities/presence-inflexion.entity");
class CreatePresenceInflexionDto {
}
exports.CreatePresenceInflexionDto = CreatePresenceInflexionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul prezenței',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul prezenței trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul prezenței este obligatoriu' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul prezenței trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], CreatePresenceInflexionDto.prototype, "presence_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Timestamp-ul punctului de inflexiune',
        example: '2024-01-15T12:00:00Z',
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Timestamp-ul trebuie să fie o dată validă în format ISO' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Timestamp-ul este obligatoriu' }),
    __metadata("design:type", String)
], CreatePresenceInflexionDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul punctului de inflexiune',
        enum: presence_inflexion_entity_1.InflexionType,
        example: presence_inflexion_entity_1.InflexionType.EXIT,
    }),
    (0, class_validator_1.IsEnum)(presence_inflexion_entity_1.InflexionType, { message: 'Tipul trebuie să fie unul dintre: exit, entry' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tipul este obligatoriu' }),
    __metadata("design:type", String)
], CreatePresenceInflexionDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Latitudinea GPS la punctul de inflexiune',
        example: 44.4268,
        required: false,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'Latitudinea GPS trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(-90, { message: 'Latitudinea trebuie să fie între -90 și 90 de grade' }),
    (0, class_validator_1.Max)(90, { message: 'Latitudinea trebuie să fie între -90 și 90 de grade' }),
    __metadata("design:type", Number)
], CreatePresenceInflexionDto.prototype, "gps_lat", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Longitudinea GPS la punctul de inflexiune',
        example: 26.1025,
        required: false,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'Longitudinea GPS trebuie să fie un număr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(-180, { message: 'Longitudinea trebuie să fie între -180 și 180 de grade' }),
    (0, class_validator_1.Max)(180, { message: 'Longitudinea trebuie să fie între -180 și 180 de grade' }),
    __metadata("design:type", Number)
], CreatePresenceInflexionDto.prototype, "gps_lng", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descrierea locației la punctul de inflexiune',
        example: 'Ieșire pentru masa de prânz',
        required: false,
    }),
    (0, class_validator_1.IsString)({ message: 'Descrierea locației trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 500, { message: 'Descrierea locației nu poate depăși 500 de caractere' }),
    __metadata("design:type", String)
], CreatePresenceInflexionDto.prototype, "location_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre punctul de inflexiune',
        example: 'Ieșire aprobată de manager pentru întâlnire de lucru',
        required: false,
    }),
    (0, class_validator_1.IsString)({ message: 'Notele trebuie să fie un string' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: 'Notele nu pot depăși 1000 de caractere' }),
    __metadata("design:type", String)
], CreatePresenceInflexionDto.prototype, "notes", void 0);
//# sourceMappingURL=create-presence-inflexion.dto.js.map
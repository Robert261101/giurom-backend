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
exports.CreateGeneratedDocumentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateGeneratedDocumentDto {
    constructor() {
        this.status = 'Generated';
    }
}
exports.CreateGeneratedDocumentDto = CreateGeneratedDocumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul angajatului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul angajatului este obligatoriu' }),
    __metadata("design:type", Number)
], CreateGeneratedDocumentDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul documentului template sau referință',
        example: 101,
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul documentului trebuie să fie un număr' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'ID-ul documentului este obligatoriu' }),
    __metadata("design:type", Number)
], CreateGeneratedDocumentDto.prototype, "doc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul documentului',
        example: 'Generated',
        enum: ['Generated', 'Signed', 'Expired', 'Cancelled', 'Draft'],
        default: 'Generated',
    }),
    (0, class_validator_1.IsString)({ message: 'Statusul trebuie să fie un string' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Statusul este obligatoriu' }),
    (0, class_validator_1.IsIn)(['Generated', 'Signed', 'Expired', 'Cancelled', 'Draft'], {
        message: 'Statusul trebuie să fie unul din: Generated, Signed, Expired, Cancelled, Draft'
    }),
    __metadata("design:type", String)
], CreateGeneratedDocumentDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data semnării documentului',
        example: '2023-12-15T10:30:00Z',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data semnării trebuie să fie în format ISO' }),
    __metadata("design:type", Date)
], CreateGeneratedDocumentDto.prototype, "signed_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data expirării documentului',
        example: '2024-12-15',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data expirării trebuie să fie în format ISO' }),
    __metadata("design:type", Date)
], CreateGeneratedDocumentDto.prototype, "expired_date", void 0);
//# sourceMappingURL=create-generated-document.dto.js.map
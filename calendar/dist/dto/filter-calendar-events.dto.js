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
exports.FilterCalendarEventsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class FilterCalendarEventsDto {
}
exports.FilterCalendarEventsDto = FilterCalendarEventsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data de început pentru filtrare',
        example: '2024-07-01T00:00:00Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], FilterCalendarEventsDto.prototype, "start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data de sfârșit pentru filtrare',
        example: '2024-07-31T23:59:59Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], FilterCalendarEventsDto.prototype, "end_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Categoria evenimentelor',
        example: 'Întâlniri',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Categoria trebuie să fie un string' }),
    __metadata("design:type", String)
], FilterCalendarEventsDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul creatorului evenimentelor',
        example: 1,
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'ID-ul creatorului trebuie să fie un număr' }),
    (0, class_validator_1.IsPositive)({ message: 'ID-ul creatorului trebuie să fie pozitiv' }),
    __metadata("design:type", Number)
], FilterCalendarEventsDto.prototype, "created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Căutare în titlu sau descriere',
        example: 'ședință',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Termenul de căutare trebuie să fie un string' }),
    __metadata("design:type", String)
], FilterCalendarEventsDto.prototype, "search", void 0);
//# sourceMappingURL=filter-calendar-events.dto.js.map
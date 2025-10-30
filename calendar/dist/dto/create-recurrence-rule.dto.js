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
exports.CreateRecurrenceRuleDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const recurrence_rule_entity_1 = require("../entities/recurrence-rule.entity");
class CreateRecurrenceRuleDto {
}
exports.CreateRecurrenceRuleDto = CreateRecurrenceRuleDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Frecvența recurenței',
        enum: recurrence_rule_entity_1.RecurrenceFrequency,
        example: recurrence_rule_entity_1.RecurrenceFrequency.WEEKLY
    }),
    (0, class_validator_1.IsEnum)(recurrence_rule_entity_1.RecurrenceFrequency, { message: 'Frecvența trebuie să fie una din valorile permise' }),
    __metadata("design:type", String)
], CreateRecurrenceRuleDto.prototype, "frequency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Intervalul de recurență (ex: la fiecare 2 săptămâni)',
        example: 1,
        minimum: 1
    }),
    (0, class_validator_1.IsNumber)({}, { message: 'Intervalul trebuie să fie un număr' }),
    (0, class_validator_1.Min)(1, { message: 'Intervalul trebuie să fie cel puțin 1' }),
    __metadata("design:type", Number)
], CreateRecurrenceRuleDto.prototype, "interval", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a recurenței',
        example: '2024-07-25T09:00:00Z'
    }),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de început trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateRecurrenceRuleDto.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a recurenței',
        example: '2024-12-31T23:59:59Z',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Data de sfârșit trebuie să fie în format ISO' }),
    __metadata("design:type", String)
], CreateRecurrenceRuleDto.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Zilele și orele recurenței în format JSON (ex: {"mon":"09:00","wed":"14:30","fri":"11:15"})',
        example: '{"mon":"09:00","wed":"14:30","fri":"11:15"}',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Zilele recurenței trebuie să fie un string JSON valid' }),
    __metadata("design:type", String)
], CreateRecurrenceRuleDto.prototype, "recurrence_days", void 0);
//# sourceMappingURL=create-recurrence-rule.dto.js.map
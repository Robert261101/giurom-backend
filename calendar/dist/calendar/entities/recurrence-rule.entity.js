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
exports.RecurrenceRule = exports.RecurrenceFrequency = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const calendar_event_entity_1 = require("./calendar-event.entity");
var RecurrenceFrequency;
(function (RecurrenceFrequency) {
    RecurrenceFrequency["DAILY"] = "daily";
    RecurrenceFrequency["WEEKLY"] = "weekly";
    RecurrenceFrequency["MONTHLY"] = "monthly";
    RecurrenceFrequency["CUSTOM"] = "custom";
})(RecurrenceFrequency || (exports.RecurrenceFrequency = RecurrenceFrequency = {}));
let RecurrenceRule = class RecurrenceRule {
};
exports.RecurrenceRule = RecurrenceRule;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID unic', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RecurrenceRule.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Frecvența recurenței',
        enum: RecurrenceFrequency,
        example: RecurrenceFrequency.WEEKLY
    }),
    (0, typeorm_1.Column)({ type: 'enum', enum: RecurrenceFrequency }),
    __metadata("design:type", String)
], RecurrenceRule.prototype, "frequency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Intervalul de recurență (ex: la fiecare 2 săptămâni)',
        example: 1
    }),
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], RecurrenceRule.prototype, "interval", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a recurenței',
        example: '2024-07-25T09:00:00Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], RecurrenceRule.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a recurenței',
        example: '2024-12-31T23:59:59Z',
        required: false
    }),
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], RecurrenceRule.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Zilele recurenței (ex: "Mon,Wed,Fri" pentru săptămânal)',
        example: 'Mon,Wed,Fri',
        required: false
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], RecurrenceRule.prototype, "recurrence_days", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => calendar_event_entity_1.CalendarEvent, (event) => event.recurrence_rule),
    __metadata("design:type", Array)
], RecurrenceRule.prototype, "events", void 0);
exports.RecurrenceRule = RecurrenceRule = __decorate([
    (0, typeorm_1.Entity)('recurrence_rules')
], RecurrenceRule);
//# sourceMappingURL=recurrence-rule.entity.js.map
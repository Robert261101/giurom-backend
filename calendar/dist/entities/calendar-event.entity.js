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
exports.CalendarEvent = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
let CalendarEvent = class CalendarEvent {
};
exports.CalendarEvent = CalendarEvent;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID unic', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], CalendarEvent.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Titlul evenimentului',
        example: 'Ședință echipă',
        maxLength: 100
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Categoria evenimentului',
        example: 'Întâlniri',
        maxLength: 100
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început',
        example: '2024-07-25T09:00:00Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], CalendarEvent.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit',
        example: '2024-07-25T10:00:00Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], CalendarEvent.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Durata în minute',
        example: 60
    }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CalendarEvent.prototype, "duration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descrierea evenimentului',
        example: 'Discutăm despre progresul proiectelor și planurile pentru săptămâna viitoare',
        required: false
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID regula de recurență',
        example: 1,
        required: false
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], CalendarEvent.prototype, "recurrence_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], CalendarEvent.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], CalendarEvent.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID angajat care a creat evenimentul',
        example: 1
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CalendarEvent.prototype, "created_by", void 0);
exports.CalendarEvent = CalendarEvent = __decorate([
    (0, typeorm_1.Entity)('calendar_event')
], CalendarEvent);
//# sourceMappingURL=calendar-event.entity.js.map
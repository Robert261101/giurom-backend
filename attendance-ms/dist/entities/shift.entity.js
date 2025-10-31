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
exports.Shift = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const presence_entity_1 = require("./presence.entity");
let Shift = class Shift {
};
exports.Shift = Shift;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al schimbului de lucru',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Shift.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul angajatului',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Shift.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației de lucru',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Shift.prototype, "work_location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul departamentului',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Shift.prototype, "department_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul poziției în departament',
        example: 1,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Shift.prototype, "position_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a schimbului',
        example: '2024-01-15T08:00:00Z',
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Shift.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a schimbului',
        example: '2024-01-15T16:00:00Z',
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Shift.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre schimbul de lucru',
        example: 'Schimb de dimineață cu responsabilități speciale',
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Shift.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data când a fost creată înregistrarea',
        example: '2024-01-15T10:30:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Shift.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data când a fost actualizată înregistrarea',
        example: '2024-01-15T10:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Shift.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prezențele înregistrate pentru acest schimb',
        type: () => [presence_entity_1.Presence],
    }),
    (0, typeorm_1.OneToMany)(() => presence_entity_1.Presence, (presence) => presence.shift, {
        cascade: true,
        eager: false,
    }),
    __metadata("design:type", Array)
], Shift.prototype, "presences", void 0);
exports.Shift = Shift = __decorate([
    (0, typeorm_1.Entity)('shifts')
], Shift);
//# sourceMappingURL=shift.entity.js.map
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
exports.Presence = exports.PresenceStatus = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const shift_entity_1 = require("./shift.entity");
const presence_inflexion_entity_1 = require("./presence-inflexion.entity");
var PresenceStatus;
(function (PresenceStatus) {
    PresenceStatus["PRESENT_FULL"] = "present_full";
    PresenceStatus["PRESENT_PARTIAL"] = "present_partial";
    PresenceStatus["ABSENT"] = "absent";
})(PresenceStatus || (exports.PresenceStatus = PresenceStatus = {}));
let Presence = class Presence {
};
exports.Presence = Presence;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al prezenței',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Presence.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul schimbului de lucru',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Presence.prototype, "shift_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data pentru care se înregistrează prezența',
        example: '2024-01-15',
    }),
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", Date)
], Presence.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul prezenței angajatului',
        enum: PresenceStatus,
        example: PresenceStatus.PRESENT_FULL,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PresenceStatus,
        default: PresenceStatus.PRESENT_FULL,
    }),
    __metadata("design:type", String)
], Presence.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Ora de check-in',
        example: '2024-01-15T08:00:00Z',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Presence.prototype, "check_in", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Ora de check-out',
        example: '2024-01-15T16:00:00Z',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Presence.prototype, "check_out", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Totalul orelor lucrate',
        example: 8.5,
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 5,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Presence.prototype, "total_hours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Flag GPS pentru ieșirea din zona permisă',
        example: false,
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Presence.prototype, "gps_exit_flag", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre prezența angajatului',
        example: 'A ieșit mai devreme din motive medicale',
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], Presence.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data când a fost creată înregistrarea',
        example: '2024-01-15T10:30:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Presence.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data când a fost actualizată înregistrarea',
        example: '2024-01-15T10:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Presence.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Schimbul de lucru pentru această prezență',
        type: () => shift_entity_1.Shift,
    }),
    (0, typeorm_1.ManyToOne)(() => shift_entity_1.Shift, (shift) => shift.presences, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }),
    (0, typeorm_1.JoinColumn)({ name: 'shift_id' }),
    __metadata("design:type", shift_entity_1.Shift)
], Presence.prototype, "shift", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Punctele de inflexiune pentru această prezență',
        type: () => [presence_inflexion_entity_1.PresenceInflexion],
    }),
    (0, typeorm_1.OneToMany)(() => presence_inflexion_entity_1.PresenceInflexion, (inflexion) => inflexion.presence, {
        cascade: true,
        eager: false,
    }),
    __metadata("design:type", Array)
], Presence.prototype, "inflexions", void 0);
exports.Presence = Presence = __decorate([
    (0, typeorm_1.Entity)('presence')
], Presence);
//# sourceMappingURL=presence.entity.js.map
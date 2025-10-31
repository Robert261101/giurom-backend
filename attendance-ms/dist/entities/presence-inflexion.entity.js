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
exports.PresenceInflexion = exports.InflexionType = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const presence_entity_1 = require("./presence.entity");
var InflexionType;
(function (InflexionType) {
    InflexionType["EXIT"] = "exit";
    InflexionType["ENTRY"] = "entry";
})(InflexionType || (exports.InflexionType = InflexionType = {}));
let PresenceInflexion = class PresenceInflexion {
};
exports.PresenceInflexion = PresenceInflexion;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al punctului de inflexiune',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PresenceInflexion.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul prezenței',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PresenceInflexion.prototype, "presence_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Timestamp-ul punctului de inflexiune',
        example: '2024-01-15T12:00:00Z',
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], PresenceInflexion.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul punctului de inflexiune',
        enum: InflexionType,
        example: InflexionType.EXIT,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: InflexionType,
    }),
    __metadata("design:type", String)
], PresenceInflexion.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Latitudinea GPS la punctul de inflexiune',
        example: 44.4268,
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 10,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Number)
], PresenceInflexion.prototype, "gps_lat", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Longitudinea GPS la punctul de inflexiune',
        example: 26.1025,
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 10,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Number)
], PresenceInflexion.prototype, "gps_lng", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descrierea locației la punctul de inflexiune',
        example: 'Ieșire pentru masa de prânz',
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], PresenceInflexion.prototype, "location_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Note despre punctul de inflexiune',
        example: 'Ieșire aprobată de manager pentru întâlnire de lucru',
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], PresenceInflexion.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prezența pentru acest punct de inflexiune',
        type: () => presence_entity_1.Presence,
    }),
    (0, typeorm_1.ManyToOne)(() => presence_entity_1.Presence, (presence) => presence.inflexions, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }),
    (0, typeorm_1.JoinColumn)({ name: 'presence_id' }),
    __metadata("design:type", presence_entity_1.Presence)
], PresenceInflexion.prototype, "presence", void 0);
exports.PresenceInflexion = PresenceInflexion = __decorate([
    (0, typeorm_1.Entity)('presence_inflexion')
], PresenceInflexion);
//# sourceMappingURL=presence-inflexion.entity.js.map
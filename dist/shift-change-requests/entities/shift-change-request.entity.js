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
exports.ShiftChangeRequest = exports.ShiftChangeStatus = exports.DurationUnit = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
var DurationUnit;
(function (DurationUnit) {
    DurationUnit["DAYS"] = "days";
    DurationUnit["HOURS"] = "hours";
})(DurationUnit || (exports.DurationUnit = DurationUnit = {}));
var ShiftChangeStatus;
(function (ShiftChangeStatus) {
    ShiftChangeStatus["PENDING"] = "pending";
    ShiftChangeStatus["APPROVED"] = "approved";
    ShiftChangeStatus["REJECTED"] = "rejected";
})(ShiftChangeStatus || (exports.ShiftChangeStatus = ShiftChangeStatus = {}));
let ShiftChangeRequest = class ShiftChangeRequest {
    get duration_in_days() {
        const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    get duration_in_hours() {
        const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60));
    }
    get shift_date() {
        return this.start_datetime.toISOString().split('T')[0];
    }
};
exports.ShiftChangeRequest = ShiftChangeRequest;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID unic', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ShiftChangeRequest.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat care cere schimbul', example: 1 }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ShiftChangeRequest.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat propus ca înlocuitor', example: 2 }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ShiftChangeRequest.prototype, "replacement_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a schimbului',
        example: '2024-08-01T08:00:00Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequest.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a schimbului',
        example: '2024-08-01T16:00:00Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequest.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unitatea de durată', enum: ['days', 'hours'], example: 'hours' }),
    (0, typeorm_1.Column)({ type: 'enum', enum: ['days', 'hours'], default: 'days' }),
    __metadata("design:type", String)
], ShiftChangeRequest.prototype, "duration_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Comentariul/motivul cererii de schimb',
        example: 'Am o urgență medicală și nu pot lucra în această tură',
        required: false
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], ShiftChangeRequest.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul cererii',
        enum: ShiftChangeStatus,
        example: ShiftChangeStatus.PENDING
    }),
    (0, typeorm_1.Column)({ type: 'enum', enum: ShiftChangeStatus, default: ShiftChangeStatus.PENDING }),
    __metadata("design:type", String)
], ShiftChangeRequest.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID manager care a aprobat/respins cererea',
        example: 3,
        required: false
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ShiftChangeRequest.prototype, "reviewed_by_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora când a fost aprobată/respinsă cererea',
        example: '2024-07-26T10:30:00Z',
        required: false
    }),
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], ShiftChangeRequest.prototype, "reviewed_at", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequest.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequest.prototype, "updated_at", void 0);
exports.ShiftChangeRequest = ShiftChangeRequest = __decorate([
    (0, typeorm_1.Entity)('shift_change_requests')
], ShiftChangeRequest);
//# sourceMappingURL=shift-change-request.entity.js.map
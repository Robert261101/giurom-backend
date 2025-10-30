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
exports.ShiftChangeRequests = exports.ShiftChangeStatus = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
var ShiftChangeStatus;
(function (ShiftChangeStatus) {
    ShiftChangeStatus["PENDING"] = "pending";
    ShiftChangeStatus["APPROVED"] = "approved";
    ShiftChangeStatus["REJECTED"] = "rejected";
})(ShiftChangeStatus || (exports.ShiftChangeStatus = ShiftChangeStatus = {}));
let ShiftChangeRequests = class ShiftChangeRequests {
};
exports.ShiftChangeRequests = ShiftChangeRequests;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID unic', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ShiftChangeRequests.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat', example: 1 }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ShiftChangeRequests.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID înlocuitor', example: 2 }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ShiftChangeRequests.prototype, "replacement_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data și ora început', example: '2024-07-25T09:00:00Z' }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequests.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data și ora sfârșit', example: '2024-07-25T17:00:00Z' }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequests.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Comentariu', example: 'Cerere schimb pentru vizită medicală', required: false }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], ShiftChangeRequests.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Status cerere', enum: ShiftChangeStatus, example: ShiftChangeStatus.PENDING }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ShiftChangeStatus,
        default: ShiftChangeStatus.PENDING
    }),
    __metadata("design:type", String)
], ShiftChangeRequests.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID reviewer', example: 3 }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ShiftChangeRequests.prototype, "reviewed_by_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data review', example: '2024-07-25T10:00:00Z' }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequests.prototype, "reviewed_at", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequests.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ShiftChangeRequests.prototype, "updated_at", void 0);
exports.ShiftChangeRequests = ShiftChangeRequests = __decorate([
    (0, typeorm_1.Entity)('shift_change_requests')
], ShiftChangeRequests);
//# sourceMappingURL=shift-change-requests.entity.js.map
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
exports.LeaveRequest = exports.DurationUnit = exports.LeaveType = exports.LeaveRequestStatus = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
var LeaveRequestStatus;
(function (LeaveRequestStatus) {
    LeaveRequestStatus["PENDING"] = "pending";
    LeaveRequestStatus["APPROVED"] = "approved";
    LeaveRequestStatus["REJECTED"] = "rejected";
})(LeaveRequestStatus || (exports.LeaveRequestStatus = LeaveRequestStatus = {}));
var LeaveType;
(function (LeaveType) {
    LeaveType["DAYS"] = "days";
    LeaveType["HOURS"] = "hours";
})(LeaveType || (exports.LeaveType = LeaveType = {}));
var DurationUnit;
(function (DurationUnit) {
    DurationUnit["DAYS"] = "days";
    DurationUnit["HOURS"] = "hours";
})(DurationUnit || (exports.DurationUnit = DurationUnit = {}));
let LeaveRequest = class LeaveRequest {
};
exports.LeaveRequest = LeaveRequest;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID unic', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], LeaveRequest.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat', example: 1 }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], LeaveRequest.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Tip concediu', maxLength: 100 }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "leave_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data și ora început', example: '2024-07-25T09:00:00Z' }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data și ora sfârșit', example: '2024-07-25T17:00:00Z' }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Comentariu', example: 'Concediu pentru odihnă', required: false }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unitatea de durată', enum: DurationUnit, example: DurationUnit.DAYS }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: DurationUnit
    }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "duration_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Status cerere', enum: LeaveRequestStatus, example: LeaveRequestStatus.PENDING }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LeaveRequestStatus,
        default: LeaveRequestStatus.PENDING
    }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID reviewer', example: 3 }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], LeaveRequest.prototype, "reviewed_by_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data review', example: '2024-07-25T10:00:00Z' }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "reviewed_at", void 0);
exports.LeaveRequest = LeaveRequest = __decorate([
    (0, typeorm_1.Entity)('leave_request')
], LeaveRequest);
//# sourceMappingURL=leave-request.entity.js.map
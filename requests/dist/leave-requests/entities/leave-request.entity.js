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
exports.LeaveRequest = exports.LeaveStatus = exports.DurationUnit = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
var DurationUnit;
(function (DurationUnit) {
    DurationUnit["DAYS"] = "days";
    DurationUnit["HOURS"] = "hours";
})(DurationUnit || (exports.DurationUnit = DurationUnit = {}));
var LeaveStatus;
(function (LeaveStatus) {
    LeaveStatus["PENDING"] = "pending";
    LeaveStatus["APPROVED"] = "approved";
    LeaveStatus["REJECTED"] = "rejected";
})(LeaveStatus || (exports.LeaveStatus = LeaveStatus = {}));
let LeaveRequest = class LeaveRequest {
    get duration_in_days() {
        const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    get duration_in_hours() {
        const diffTime = Math.abs(this.end_datetime.getTime() - this.start_datetime.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60));
    }
};
exports.LeaveRequest = LeaveRequest;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID unic', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], LeaveRequest.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID angajat care face cererea', example: 1 }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], LeaveRequest.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul concediului',
        example: 'Concediu de odihnă',
        maxLength: 100
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "leave_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de început a concediului',
        example: '2024-08-01T00:00:00Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "start_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora de sfârșit a concediului',
        example: '2024-08-05T23:59:59Z'
    }),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "end_datetime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Comentariul/motivul cererii',
        example: 'Concediu planificat pentru vacanța de vară',
        required: false
    }),
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unitatea de măsură pentru durată',
        enum: DurationUnit,
        example: DurationUnit.DAYS
    }),
    (0, typeorm_1.Column)({ type: 'enum', enum: DurationUnit, default: DurationUnit.DAYS }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "duration_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Statusul cererii',
        enum: LeaveStatus,
        example: LeaveStatus.PENDING
    }),
    (0, typeorm_1.Column)({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING }),
    __metadata("design:type", String)
], LeaveRequest.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID manager care a aprobat/respins cererea',
        example: 2,
        required: false
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], LeaveRequest.prototype, "reviewed_by_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data și ora când a fost aprobată/respinsă cererea',
        example: '2024-07-26T10:30:00Z',
        required: false
    }),
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "reviewed_at", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], LeaveRequest.prototype, "updated_at", void 0);
exports.LeaveRequest = LeaveRequest = __decorate([
    (0, typeorm_1.Entity)('leave_requests')
], LeaveRequest);
//# sourceMappingURL=leave-request.entity.js.map
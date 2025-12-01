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
exports.WorkLocationRevenue = exports.RevenueStatus = void 0;
const typeorm_1 = require("typeorm");
var RevenueStatus;
(function (RevenueStatus) {
    RevenueStatus["Pending"] = "pending";
    RevenueStatus["Approved"] = "approved";
    RevenueStatus["Canceled"] = "canceled";
})(RevenueStatus || (exports.RevenueStatus = RevenueStatus = {}));
let WorkLocationRevenue = class WorkLocationRevenue {
};
exports.WorkLocationRevenue = WorkLocationRevenue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'location_id' }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "work_location_id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", String)
], WorkLocationRevenue.prototype, "revenue_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, name: 'online_amount', default: 0 }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "online_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, name: 'cash_amount', default: 0 }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "cash_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, name: 'card_amount', default: 0 }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "card_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "total_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: RevenueStatus, nullable: true, name: 'status' }),
    __metadata("design:type", String)
], WorkLocationRevenue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true, name: 'image_url' }),
    __metadata("design:type", String)
], WorkLocationRevenue.prototype, "image_url", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int', nullable: true, name: 'user_id' }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "user_id", void 0);
exports.WorkLocationRevenue = WorkLocationRevenue = __decorate([
    (0, typeorm_1.Entity)('WorkLocation_Revenue')
], WorkLocationRevenue);
//# sourceMappingURL=work-location-revenue.entity.js.map
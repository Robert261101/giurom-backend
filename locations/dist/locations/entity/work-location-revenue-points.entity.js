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
exports.WorkLocationRevenuePoints = void 0;
const typeorm_1 = require("typeorm");
let WorkLocationRevenuePoints = class WorkLocationRevenuePoints {
};
exports.WorkLocationRevenuePoints = WorkLocationRevenuePoints;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationRevenuePoints.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'location_id' }),
    __metadata("design:type", Number)
], WorkLocationRevenuePoints.prototype, "work_location_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, name: 'min_amount' }),
    __metadata("design:type", Number)
], WorkLocationRevenuePoints.prototype, "min_revenue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'max_amount' }),
    __metadata("design:type", Number)
], WorkLocationRevenuePoints.prototype, "max_revenue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 4, name: 'points_per_unit' }),
    __metadata("design:type", Number)
], WorkLocationRevenuePoints.prototype, "points", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime', name: 'created_at' }),
    __metadata("design:type", Date)
], WorkLocationRevenuePoints.prototype, "created_at", void 0);
exports.WorkLocationRevenuePoints = WorkLocationRevenuePoints = __decorate([
    (0, typeorm_1.Entity)('WorkLocation_RevenuePoints')
], WorkLocationRevenuePoints);
//# sourceMappingURL=work-location-revenue-points.entity.js.map
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
exports.WorkLocationRevenue = void 0;
const typeorm_1 = require("typeorm");
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
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], WorkLocationRevenue.prototype, "revenue_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, name: 'amount' }),
    __metadata("design:type", Number)
], WorkLocationRevenue.prototype, "revenue_amount", void 0);
exports.WorkLocationRevenue = WorkLocationRevenue = __decorate([
    (0, typeorm_1.Entity)('WorkLocation_Revenue')
], WorkLocationRevenue);
//# sourceMappingURL=work-location-revenue.entity.js.map
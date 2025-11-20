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
exports.WorkLocationManagerConfig = void 0;
const typeorm_1 = require("typeorm");
let WorkLocationManagerConfig = class WorkLocationManagerConfig {
};
exports.WorkLocationManagerConfig = WorkLocationManagerConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationManagerConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'location_id' }),
    __metadata("design:type", Number)
], WorkLocationManagerConfig.prototype, "work_location_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'manager_percentage' }),
    __metadata("design:type", Number)
], WorkLocationManagerConfig.prototype, "manager_percent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationManagerConfig.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationManagerConfig.prototype, "updated_at", void 0);
exports.WorkLocationManagerConfig = WorkLocationManagerConfig = __decorate([
    (0, typeorm_1.Entity)('WorkLocation_ManagerConfig')
], WorkLocationManagerConfig);
//# sourceMappingURL=work-location-manager-config.entity.js.map
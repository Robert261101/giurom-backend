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
exports.WorkLocationDepartments = void 0;
const typeorm_1 = require("typeorm");
const work_location_entity_1 = require("./work-location.entity");
const work_location_department_positions_entity_1 = require("./work-location-department-positions.entity");
let WorkLocationDepartments = class WorkLocationDepartments {
};
exports.WorkLocationDepartments = WorkLocationDepartments;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationDepartments.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocationDepartments.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocationDepartments.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocationDepartments.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WorkLocationDepartments.prototype, "work_location_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationDepartments.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationDepartments.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_location_entity_1.WorkLocation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'work_location_id' }),
    __metadata("design:type", work_location_entity_1.WorkLocation)
], WorkLocationDepartments.prototype, "work_location", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_location_department_positions_entity_1.WorkLocationDepartmentPositions, (position) => position.department, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], WorkLocationDepartments.prototype, "positions", void 0);
exports.WorkLocationDepartments = WorkLocationDepartments = __decorate([
    (0, typeorm_1.Entity)('worklocation_departments')
], WorkLocationDepartments);
//# sourceMappingURL=work-location-departments.entity.js.map
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
exports.WorkLocationDepartmentPositions = void 0;
const typeorm_1 = require("typeorm");
const work_location_departments_entity_1 = require("./work-location-departments.entity");
let WorkLocationDepartmentPositions = class WorkLocationDepartmentPositions {
};
exports.WorkLocationDepartmentPositions = WorkLocationDepartmentPositions;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationDepartmentPositions.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocationDepartmentPositions.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocationDepartmentPositions.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocationDepartmentPositions.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WorkLocationDepartmentPositions.prototype, "department_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationDepartmentPositions.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationDepartmentPositions.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_location_departments_entity_1.WorkLocationDepartments, (department) => department.positions, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'department_id' }),
    __metadata("design:type", work_location_departments_entity_1.WorkLocationDepartments)
], WorkLocationDepartmentPositions.prototype, "department", void 0);
exports.WorkLocationDepartmentPositions = WorkLocationDepartmentPositions = __decorate([
    (0, typeorm_1.Entity)('worklocation_department_positions')
], WorkLocationDepartmentPositions);
//# sourceMappingURL=work-location-department-positions.entity.js.map
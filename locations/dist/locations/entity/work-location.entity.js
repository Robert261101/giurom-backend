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
exports.WorkLocation = void 0;
const typeorm_1 = require("typeorm");
const work_location_task_template_entity_1 = require("../entity/work-location-task-template.entity");
const work_location_departments_entity_1 = require("../entity/work-location-departments.entity");
const work_location_files_entity_1 = require("./work-location-files.entity");
let WorkLocation = class WorkLocation {
};
exports.WorkLocation = WorkLocation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WorkLocation.prototype, "company_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "location_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "county", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "postal_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci', default: 'Romania' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "phone_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', name: 'created_at', nullable: true }),
    __metadata("design:type", Date)
], WorkLocation.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], WorkLocation.prototype, "employee_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], WorkLocation.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 10, nullable: true }),
    __metadata("design:type", Number)
], WorkLocation.prototype, "gps_lat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 10, nullable: true }),
    __metadata("design:type", Number)
], WorkLocation.prototype, "gps_lng", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], WorkLocation.prototype, "gps_radius_m", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_location_task_template_entity_1.WorkLocationTaskTemplate, (taskTemplate) => taskTemplate.work_location, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], WorkLocation.prototype, "task_templates", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_location_departments_entity_1.WorkLocationDepartments, (department) => department.work_location, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], WorkLocation.prototype, "departments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_location_files_entity_1.WorkLocationFiles, (file) => file.workLocation, { cascade: true, eager: false }),
    __metadata("design:type", Array)
], WorkLocation.prototype, "location_files", void 0);
exports.WorkLocation = WorkLocation = __decorate([
    (0, typeorm_1.Entity)('work_location')
], WorkLocation);
//# sourceMappingURL=work-location.entity.js.map
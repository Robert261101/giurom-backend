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
exports.WorkLocationTaskTemplate = void 0;
const typeorm_1 = require("typeorm");
const work_location_entity_1 = require("../entity/work-location.entity");
let WorkLocationTaskTemplate = class WorkLocationTaskTemplate {
};
exports.WorkLocationTaskTemplate = WorkLocationTaskTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationTaskTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WorkLocationTaskTemplate.prototype, "location_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], WorkLocationTaskTemplate.prototype, "template_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], WorkLocationTaskTemplate.prototype, "assigned_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WorkLocationTaskTemplate.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], WorkLocationTaskTemplate.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_location_entity_1.WorkLocation, (location) => location.task_templates, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'location_id' }),
    __metadata("design:type", work_location_entity_1.WorkLocation)
], WorkLocationTaskTemplate.prototype, "work_location", void 0);
exports.WorkLocationTaskTemplate = WorkLocationTaskTemplate = __decorate([
    (0, typeorm_1.Entity)('worklocation_tasktemplate')
], WorkLocationTaskTemplate);
//# sourceMappingURL=work-location-task-template.entity.js.map
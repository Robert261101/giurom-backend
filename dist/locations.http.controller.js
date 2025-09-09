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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationsHttpController = void 0;
const common_1 = require("@nestjs/common");
const locations_service_1 = require("./locations/locations.service");
const create_work_location_dto_1 = require("./locations/dto/create-work-location.dto");
const update_work_location_dto_1 = require("./locations/dto/update-work-location.dto");
const create_task_template_assignment_dto_1 = require("./locations/dto/create-task-template-assignment.dto");
const update_task_template_assignment_dto_1 = require("./locations/dto/update-task-template-assignment.dto");
let LocationsHttpController = class LocationsHttpController {
    constructor(service) {
        this.service = service;
    }
    create(dto) { return this.service.createWorkLocation(dto); }
    findAll(page = '1', limit = '10', companyId, city, search) {
        return this.service.findAllWorkLocations(parseInt(page, 10), parseInt(limit, 10), companyId ? parseInt(companyId, 10) : undefined, city, search);
    }
    stats() { return this.service.getLocationStatistics(); }
    findOne(id) { return this.service.findWorkLocationById(parseInt(id, 10)); }
    findByCompany(companyId) { return this.service.findWorkLocationsByCompany(parseInt(companyId, 10)); }
    update(id, dto) { return this.service.updateWorkLocation(parseInt(id, 10), dto); }
    remove(id) { return this.service.removeWorkLocation(parseInt(id, 10)); }
    createAssignment(dto) { return this.service.createTaskTemplateAssignment(dto); }
    findAllAssignments(page = '1', limit = '10', locationId, templateId, active) {
        return this.service.findAllTaskTemplateAssignments(parseInt(page, 10), parseInt(limit, 10), locationId ? parseInt(locationId, 10) : undefined, templateId ? parseInt(templateId, 10) : undefined, active !== undefined ? active === 'true' : undefined);
    }
    findAssignment(id) { return this.service.findTaskTemplateAssignmentById(parseInt(id, 10)); }
    findAssignmentsByLocation(locationId) { return this.service.findTaskTemplateAssignmentsByLocation(parseInt(locationId, 10)); }
    findDepartmentsByLocation(locationId) { return this.service.findDepartmentsByLocation(parseInt(locationId, 10)); }
    createDepartment(locationId, body) {
        return this.service.createDepartment({
            work_location_id: body.work_location_id ?? parseInt(locationId, 10),
            name: body.name,
            code: body.code,
            description: body.description,
        });
    }
    findPositions(departmentId) { return this.service.findPositionsByDepartment(parseInt(departmentId, 10)); }
    createPosition(departmentId, body) {
        return this.service.createDepartmentPosition({ department_id: parseInt(departmentId, 10), name: body.name, code: body.code, description: body.description });
    }
    updateAssignment(id, dto) { return this.service.updateTaskTemplateAssignment(parseInt(id, 10), dto); }
    toggleAssignment(id, active = 'true') { return this.service.toggleAssignmentStatus(parseInt(id, 10), active === 'true'); }
    deactivateTemplate(templateId) { return this.service.deactivateTemplateAssignments(parseInt(templateId, 10)); }
    removeAssignment(id) { return this.service.removeTaskTemplateAssignment(parseInt(id, 10)); }
    setIntervals(id, body) {
        return this.service.setRevenueIntervals(parseInt(id, 10), body.intervals || []);
    }
    getIntervals(id) {
        return this.service.getRevenueIntervals(parseInt(id, 10));
    }
    setManagerPercent(id, body) {
        return this.service.setManagerPercent(parseInt(id, 10), body.manager_percent, body.fallback_revenue_per_point);
    }
    getManagerConfig(id) {
        return this.service.getManagerConfig(parseInt(id, 10));
    }
    recordRevenue(id, body) {
        return this.service.recordRevenue(parseInt(id, 10), body.revenue_date, body.revenue_amount);
    }
    listRevenue(id, startDate, endDate, page = '1', limit = '50') {
        return this.service.listRevenue(parseInt(id, 10), { startDate, endDate, page: parseInt(page, 10), limit: parseInt(limit, 10) });
    }
    managerPoints(id, date) {
        return this.service.getManagerPointsForDate(parseInt(id, 10), date);
    }
};
exports.LocationsHttpController = LocationsHttpController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_work_location_dto_1.CreateWorkLocationDto]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('companyId')),
    __param(3, (0, common_1.Query)('city')),
    __param(4, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('company/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findByCompany", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_work_location_dto_1.UpdateWorkLocationDto]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('assignments'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_task_template_assignment_dto_1.CreateTaskTemplateAssignmentDto]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "createAssignment", null);
__decorate([
    (0, common_1.Get)('assignments'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('locationId')),
    __param(3, (0, common_1.Query)('templateId')),
    __param(4, (0, common_1.Query)('active')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findAllAssignments", null);
__decorate([
    (0, common_1.Get)('assignments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findAssignment", null);
__decorate([
    (0, common_1.Get)(':locationId/assignments'),
    __param(0, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findAssignmentsByLocation", null);
__decorate([
    (0, common_1.Get)(':locationId/departments'),
    __param(0, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findDepartmentsByLocation", null);
__decorate([
    (0, common_1.Post)(':locationId/departments'),
    __param(0, (0, common_1.Param)('locationId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "createDepartment", null);
__decorate([
    (0, common_1.Get)('departments/:departmentId/positions'),
    __param(0, (0, common_1.Param)('departmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "findPositions", null);
__decorate([
    (0, common_1.Post)('departments/:departmentId/positions'),
    __param(0, (0, common_1.Param)('departmentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "createPosition", null);
__decorate([
    (0, common_1.Patch)('assignments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_template_assignment_dto_1.UpdateTaskTemplateAssignmentDto]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "updateAssignment", null);
__decorate([
    (0, common_1.Patch)('assignments/:id/toggle'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('active')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "toggleAssignment", null);
__decorate([
    (0, common_1.Patch)('templates/:templateId/deactivate'),
    __param(0, (0, common_1.Param)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "deactivateTemplate", null);
__decorate([
    (0, common_1.Delete)('assignments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "removeAssignment", null);
__decorate([
    (0, common_1.Post)(':id/revenue-intervals'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "setIntervals", null);
__decorate([
    (0, common_1.Get)(':id/revenue-intervals'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "getIntervals", null);
__decorate([
    (0, common_1.Patch)(':id/manager-percent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "setManagerPercent", null);
__decorate([
    (0, common_1.Get)(':id/manager-config'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "getManagerConfig", null);
__decorate([
    (0, common_1.Post)(':id/revenue'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "recordRevenue", null);
__decorate([
    (0, common_1.Get)(':id/revenue'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "listRevenue", null);
__decorate([
    (0, common_1.Get)(':id/manager-points'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LocationsHttpController.prototype, "managerPoints", null);
exports.LocationsHttpController = LocationsHttpController = __decorate([
    (0, common_1.Controller)('locations'),
    __metadata("design:paramtypes", [locations_service_1.LocationsService])
], LocationsHttpController);
//# sourceMappingURL=locations.http.controller.js.map
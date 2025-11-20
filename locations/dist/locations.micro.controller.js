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
exports.LocationsMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const locations_service_1 = require("./locations/locations.service");
const create_work_location_dto_1 = require("./locations/dto/create-work-location.dto");
const create_task_template_assignment_dto_1 = require("./locations/dto/create-task-template-assignment.dto");
let LocationsMicroController = class LocationsMicroController {
    constructor(locationsService) {
        this.locationsService = locationsService;
    }
    create(dto) {
        return this.locationsService.createWorkLocation(dto);
    }
    findAll(payload) {
        return this.locationsService.findAllWorkLocations(payload.page, payload.limit, payload.companyId, payload.city, payload.search);
    }
    statistics() {
        return this.locationsService.getLocationStatistics();
    }
    findByCompany(companyId) {
        return this.locationsService.findWorkLocationsByCompany(companyId);
    }
    findById(id) {
        return this.locationsService.findWorkLocationById(id);
    }
    update(payload) {
        return this.locationsService.updateWorkLocation(payload.id, payload.dto);
    }
    remove(id) {
        return this.locationsService.removeWorkLocation(id);
    }
    createAssignment(dto) {
        return this.locationsService.createTaskTemplateAssignment(dto);
    }
    findAllAssignments(payload) {
        return this.locationsService.findAllTaskTemplateAssignments(payload.page, payload.limit, payload.locationId, payload.templateId, payload.active);
    }
    findAssignmentsByLocation(locationId) {
        return this.locationsService.findTaskTemplateAssignmentsByLocation(locationId);
    }
    findAssignmentById(assignmentId) {
        return this.locationsService.findTaskTemplateAssignmentById(assignmentId);
    }
    updateAssignment(payload) {
        return this.locationsService.updateTaskTemplateAssignment(payload.assignmentId, payload.dto);
    }
    toggleAssignment(payload) {
        return this.locationsService.toggleAssignmentStatus(payload.assignmentId, payload.active);
    }
    removeAssignment(assignmentId) {
        return this.locationsService.removeTaskTemplateAssignment(assignmentId);
    }
    deactivateTemplateAssignments(templateId) {
        return this.locationsService.deactivateTemplateAssignments(templateId);
    }
};
exports.LocationsMicroController = LocationsMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('locations.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_work_location_dto_1.CreateWorkLocationDto]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "create", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "findAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "statistics", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.findByCompany'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "findByCompany", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.findById'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "findById", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "update", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "remove", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_task_template_assignment_dto_1.CreateTaskTemplateAssignmentDto]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "createAssignment", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "findAllAssignments", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.findByLocation'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "findAssignmentsByLocation", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.findById'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "findAssignmentById", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "updateAssignment", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.toggle'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "toggleAssignment", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.assignments.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "removeAssignment", null);
__decorate([
    (0, microservices_1.MessagePattern)('locations.templates.deactivate'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LocationsMicroController.prototype, "deactivateTemplateAssignments", null);
exports.LocationsMicroController = LocationsMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [locations_service_1.LocationsService])
], LocationsMicroController);
//# sourceMappingURL=locations.micro.controller.js.map
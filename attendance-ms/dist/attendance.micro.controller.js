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
exports.AttendanceMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const attendance_service_1 = require("./attendance.service");
const create_shift_dto_1 = require("./dto/create-shift.dto");
const create_presence_dto_1 = require("./dto/create-presence.dto");
const create_presence_inflexion_dto_1 = require("./dto/create-presence-inflexion.dto");
let AttendanceMicroController = class AttendanceMicroController {
    constructor(service) {
        this.service = service;
    }
    createShift(dto) {
        return this.service.createShift(dto);
    }
    findAllShifts(payload) {
        return this.service.findAllShifts(payload.page || 1, payload.limit || 10, payload.employee_id, payload.work_location_id, payload.department_id);
    }
    findShift(id) {
        return this.service.findShiftById(id);
    }
    updateShift(payload) {
        return this.service.updateShift(payload.id, payload.dto);
    }
    deleteShift(id) {
        return this.service.deleteShift(id);
    }
    createPresence(dto) {
        return this.service.createPresence(dto);
    }
    findAllPresences(payload) {
        return this.service.findAllPresences(payload.page?.toString(), payload.limit?.toString(), payload.shift_id?.toString(), payload.status, payload.start_date, payload.end_date);
    }
    findPresence(id) {
        return this.service.findPresenceById(id);
    }
    updatePresence(payload) {
        return this.service.updatePresence(payload.id, payload.dto);
    }
    deletePresence(id) {
        return this.service.deletePresence(id);
    }
    createInflexion(dto) {
        return this.service.createPresenceInflexion(dto);
    }
    findAllInflexions(payload) {
        return this.service.findAllPresenceInflexions(payload.page || 1, payload.limit || 10, payload.presence_id, payload.type);
    }
    findInflexion(id) {
        return this.service.findPresenceInflexionById(id);
    }
    updateInflexion(payload) {
        return this.service.updatePresenceInflexion(payload.id, payload.dto);
    }
    deleteInflexion(id) {
        return this.service.deletePresenceInflexion(id);
    }
    statistics(payload) {
        return this.service.getAttendanceStatistics(payload.employee_id, payload.start_date, payload.end_date);
    }
};
exports.AttendanceMicroController = AttendanceMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('attendance.shifts.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_shift_dto_1.CreateShiftDto]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "createShift", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.shifts.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "findAllShifts", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.shifts.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "findShift", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.shifts.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "updateShift", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.shifts.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "deleteShift", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.presences.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_presence_dto_1.CreatePresenceDto]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "createPresence", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.presences.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "findAllPresences", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.presences.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "findPresence", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.presences.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "updatePresence", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.presences.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "deletePresence", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.inflexions.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_presence_inflexion_dto_1.CreatePresenceInflexionDto]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "createInflexion", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.inflexions.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "findAllInflexions", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.inflexions.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "findInflexion", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.inflexions.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "updateInflexion", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.inflexions.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "deleteInflexion", null);
__decorate([
    (0, microservices_1.MessagePattern)('attendance.statistics'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceMicroController.prototype, "statistics", null);
exports.AttendanceMicroController = AttendanceMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [attendance_service_1.AttendanceService])
], AttendanceMicroController);
//# sourceMappingURL=attendance.micro.controller.js.map
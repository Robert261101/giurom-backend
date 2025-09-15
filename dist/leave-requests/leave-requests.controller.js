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
exports.LeaveRequestsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const leave_requests_service_1 = require("./leave-requests.service");
const create_leave_request_dto_1 = require("./dto/create-leave-request.dto");
const update_leave_request_status_dto_1 = require("./dto/update-leave-request-status.dto");
const filter_leave_requests_dto_1 = require("./dto/filter-leave-requests.dto");
const leave_request_entity_1 = require("./entities/leave-request.entity");
let LeaveRequestsController = class LeaveRequestsController {
    constructor(leaveRequestsService) {
        this.leaveRequestsService = leaveRequestsService;
    }
    create(createLeaveRequestDto, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.leaveRequestsService.create(createLeaveRequestDto, userId);
    }
    findAll(filters, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.leaveRequestsService.findAll(filters, userId);
    }
    findPending(currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.leaveRequestsService.findPending(userId);
    }
    findOne(id, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.leaveRequestsService.findOne(id, userId);
    }
    updateStatus(id, updateStatusDto, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.leaveRequestsService.updateStatus(id, updateStatusDto, userId);
    }
    remove(id, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.leaveRequestsService.remove(id, userId);
    }
    getEmployeeStats(employeeId, year) {
        return this.leaveRequestsService.getEmployeeStats(employeeId, year);
    }
};
exports.LeaveRequestsController = LeaveRequestsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Creează o cerere de concediu cu status pending' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Cererea de concediu a fost creată cu succes',
        type: leave_request_entity_1.LeaveRequest,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide sau suprapunere cu alte cereri aprobate',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Angajatul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu poți crea cereri pentru alți angajați',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_leave_request_dto_1.CreateLeaveRequestDto, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obține cereri de concediu cu filtrare opțională' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista cererilor de concediu',
        type: [leave_request_entity_1.LeaveRequest],
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [filter_leave_requests_dto_1.FilterLeaveRequestsDto, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('pending'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține toate cererile de concediu în așteptare' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista cererilor de concediu în așteptare',
        type: [leave_request_entity_1.LeaveRequest],
    }),
    __param(0, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "findPending", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține detaliile unei cereri de concediu specifice' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul cererii de concediu' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Detaliile cererii de concediu',
        type: leave_request_entity_1.LeaveRequest,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Cererea de concediu nu a fost găsită',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să vezi această cerere de concediu',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifică statusul unei cereri de concediu (aprobare/respingere)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul cererii de concediu' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statusul cererii a fost actualizat cu succes',
        type: leave_request_entity_1.LeaveRequest,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Cererea de concediu sau managerul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să aprobi/respingi cereri de concediu',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Doar cererile în așteptare pot fi modificate sau nu poți aproba propria cerere',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_leave_request_status_dto_1.UpdateLeaveRequestStatusDto, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Șterge o cerere de concediu (doar dacă este pending)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul cererii de concediu' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Cererea de concediu a fost ștearsă cu succes',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Cererea de concediu nu a fost găsită',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu poți șterge cereri de concediu ale altor angajați',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Doar cererile în așteptare pot fi șterse',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține statisticile de concediu pentru un angajat' }),
    (0, swagger_1.ApiParam)({ name: 'employeeId', description: 'ID-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statisticile de concediu ale angajatului',
    }),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "getEmployeeStats", null);
exports.LeaveRequestsController = LeaveRequestsController = __decorate([
    (0, swagger_1.ApiTags)('leave-requests'),
    (0, common_1.Controller)('leave-requests'),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [leave_requests_service_1.LeaveRequestsService])
], LeaveRequestsController);
//# sourceMappingURL=leave-requests.controller.js.map
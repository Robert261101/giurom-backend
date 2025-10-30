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
exports.ShiftChangeRequestsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shift_change_requests_service_1 = require("./shift-change-requests.service");
const create_shift_change_request_dto_1 = require("./dto/create-shift-change-request.dto");
const update_shift_change_status_dto_1 = require("./dto/update-shift-change-status.dto");
const filter_shift_change_requests_dto_1 = require("./dto/filter-shift-change-requests.dto");
const shift_change_request_entity_1 = require("./entities/shift-change-request.entity");
let ShiftChangeRequestsController = class ShiftChangeRequestsController {
    constructor(shiftChangeRequestsService) {
        this.shiftChangeRequestsService = shiftChangeRequestsService;
    }
    create(createShiftChangeRequestDto, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.create(createShiftChangeRequestDto, userId);
    }
    findAll(filters, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.findAll(filters, userId);
    }
    findPending(currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.findPending(userId);
    }
    findOne(id, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.findOne(id, userId);
    }
    updateStatus(id, updateStatusDto, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.updateStatus(id, updateStatusDto, userId);
    }
    remove(id, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.remove(id, userId);
    }
    getEmployeeStats(employeeId, year) {
        return this.shiftChangeRequestsService.getEmployeeStats(employeeId, year);
    }
    findByEmployee(employeeId, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.shiftChangeRequestsService.findByEmployee(employeeId, userId);
    }
};
exports.ShiftChangeRequestsController = ShiftChangeRequestsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Creează o cerere de schimb de tură cu status pending' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Cererea de schimb de tură a fost creată cu succes',
        type: shift_change_request_entity_1.ShiftChangeRequest,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide sau suprapunere cu alte cereri aprobate',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Angajatul sau înlocuitorul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu poți crea cereri pentru alți angajați',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_shift_change_request_dto_1.CreateShiftChangeRequestDto, String]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obține cereri de schimb de tură cu filtrare opțională' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista cererilor de schimb de tură',
        type: [shift_change_request_entity_1.ShiftChangeRequest],
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [filter_shift_change_requests_dto_1.FilterShiftChangeRequestsDto, String]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('pending'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține toate cererile de schimb de tură în așteptare' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista cererilor de schimb de tură în așteptare',
        type: [shift_change_request_entity_1.ShiftChangeRequest],
    }),
    __param(0, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "findPending", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține detaliile unei cereri de schimb de tură specifice' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul cererii de schimb de tură' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Detaliile cererii de schimb de tură',
        type: shift_change_request_entity_1.ShiftChangeRequest,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Cererea de schimb de tură nu a fost găsită',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să vezi această cerere de schimb de tură',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifică statusul unei cereri de schimb de tură (aprobare/respingere)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul cererii de schimb de tură' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statusul cererii a fost actualizat cu succes',
        type: shift_change_request_entity_1.ShiftChangeRequest,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Cererea de schimb de tură sau managerul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să aprobi/respingi cereri de schimb de tură',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Doar cererile în așteptare pot fi modificate sau nu poți aproba cereri în care ești implicat',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_shift_change_status_dto_1.UpdateShiftChangeStatusDto, String]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Șterge o cerere de schimb de tură (doar dacă este pending)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul cererii de schimb de tură' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Cererea de schimb de tură a fost ștearsă cu succes',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Cererea de schimb de tură nu a fost găsită',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu poți șterge cereri de schimb de tură ale altor angajați',
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
], ShiftChangeRequestsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține statisticile de schimb de tură pentru un angajat' }),
    (0, swagger_1.ApiParam)({ name: 'employeeId', description: 'ID-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statisticile de schimb de tură ale angajatului',
    }),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "getEmployeeStats", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține cererile de schimb de tură pentru un angajat (ca requester sau replacement)' }),
    (0, swagger_1.ApiParam)({ name: 'employeeId', description: 'ID-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista cererilor de schimb de tură ale angajatului',
        type: [shift_change_request_entity_1.ShiftChangeRequest],
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu poți vedea cererile altor angajați',
    }),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], ShiftChangeRequestsController.prototype, "findByEmployee", null);
exports.ShiftChangeRequestsController = ShiftChangeRequestsController = __decorate([
    (0, swagger_1.ApiTags)('shift-change-requests'),
    (0, common_1.Controller)('shift-change-requests'),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [shift_change_requests_service_1.ShiftChangeRequestsService])
], ShiftChangeRequestsController);
//# sourceMappingURL=shift-change-requests.controller.js.map
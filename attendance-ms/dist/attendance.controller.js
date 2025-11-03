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
exports.AttendanceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const attendance_service_1 = require("./attendance.service");
const permissions_decorator_1 = require("./permissions/permissions.decorator");
const create_shift_dto_1 = require("./dto/create-shift.dto");
const update_shift_dto_1 = require("./dto/update-shift.dto");
const create_presence_dto_1 = require("./dto/create-presence.dto");
const update_presence_dto_1 = require("./dto/update-presence.dto");
const create_presence_inflexion_dto_1 = require("./dto/create-presence-inflexion.dto");
const update_presence_inflexion_dto_1 = require("./dto/update-presence-inflexion.dto");
const shift_entity_1 = require("./entities/shift.entity");
const presence_entity_1 = require("./entities/presence.entity");
const presence_inflexion_entity_1 = require("./entities/presence-inflexion.entity");
let AttendanceController = class AttendanceController {
    constructor(attendanceService) {
        this.attendanceService = attendanceService;
    }
    async createShift(createShiftDto) {
        return await this.attendanceService.createShift(createShiftDto);
    }
    async findAllShifts(page, limit, employee_id, work_location_id, department_id) {
        const p = Number(page || 1);
        const l = Number(limit || 10);
        const emp = employee_id !== undefined ? Number(employee_id) : undefined;
        const loc = work_location_id !== undefined ? Number(work_location_id) : undefined;
        const dep = department_id !== undefined ? Number(department_id) : undefined;
        return await this.attendanceService.findAllShifts(p, l, emp, loc, dep);
    }
    async findShiftById(id) {
        return await this.attendanceService.findShiftById(id);
    }
    async updateShift(id, updateShiftDto) {
        return await this.attendanceService.updateShift(id, updateShiftDto);
    }
    async deleteShift(id) {
        return await this.attendanceService.deleteShift(id);
    }
    async createPresence(createPresenceDto) {
        return await this.attendanceService.createPresence(createPresenceDto);
    }
    async findAllPresences(page, limit, shift_id, status, start_date, end_date) {
        return await this.attendanceService.findAllPresences(page, limit, shift_id, status, start_date, end_date);
    }
    async findPresenceById(id) {
        return await this.attendanceService.findPresenceById(id);
    }
    async updatePresence(id, updatePresenceDto) {
        return await this.attendanceService.updatePresence(id, updatePresenceDto);
    }
    async deletePresence(id) {
        return await this.attendanceService.deletePresence(id);
    }
    async createPresenceInflexion(createInflexionDto) {
        return await this.attendanceService.createPresenceInflexion(createInflexionDto);
    }
    async findAllPresenceInflexions(page = 1, limit = 10, presence_id, type) {
        return await this.attendanceService.findAllPresenceInflexions(page, limit, presence_id, type);
    }
    async findPresenceInflexionById(id) {
        return await this.attendanceService.findPresenceInflexionById(id);
    }
    async updatePresenceInflexion(id, updateInflexionDto) {
        return await this.attendanceService.updatePresenceInflexion(id, updateInflexionDto);
    }
    async deletePresenceInflexion(id) {
        return await this.attendanceService.deletePresenceInflexion(id);
    }
    async getAttendanceStatistics(employee_id, start_date, end_date) {
        return await this.attendanceService.getAttendanceStatistics(employee_id, start_date, end_date);
    }
};
exports.AttendanceController = AttendanceController;
__decorate([
    (0, common_1.Post)('shifts'),
    (0, permissions_decorator_1.Permissions)('attendance.create'),
    (0, swagger_1.ApiOperation)({
        summary: 'Creează un nou schimb de lucru',
        description: 'Creează un schimb de lucru pentru un angajat cu validare de overlap și conflicte.',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Schimbul a fost creat cu succes',
        type: shift_entity_1.Shift,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide sau conflict de programare',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CONFLICT,
        description: 'Există deja un schimb programat în intervalul specificat',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_shift_dto_1.CreateShiftDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createShift", null);
__decorate([
    (0, common_1.Get)('shifts'),
    (0, permissions_decorator_1.Permissions)('attendance.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Listează toate schimburile de lucru',
        description: 'Returnează o listă paginată cu toate schimburile de lucru cu opțiuni de filtrare.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, description: 'Numărul paginii', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 }),
    (0, swagger_1.ApiQuery)({ name: 'employee_id', required: false, description: 'Filtrare după ID-ul angajatului', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'work_location_id', required: false, description: 'Filtrare după ID-ul locației', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'department_id', required: false, description: 'Filtrare după ID-ul departamentului', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista schimburilor a fost returnată cu succes',
    }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('employee_id')),
    __param(3, (0, common_1.Query)('work_location_id')),
    __param(4, (0, common_1.Query)('department_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "findAllShifts", null);
__decorate([
    (0, common_1.Get)('shifts/:id'),
    (0, permissions_decorator_1.Permissions)('attendance.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține un schimb de lucru după ID',
        description: 'Returnează detaliile complete ale unui schimb de lucru inclusiv relațiile.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul schimbului de lucru', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Schimbul a fost găsit cu succes',
        type: shift_entity_1.Shift,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Schimbul nu a fost găsit',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "findShiftById", null);
__decorate([
    (0, common_1.Patch)('shifts/:id'),
    (0, permissions_decorator_1.Permissions)('attendance.update'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizează un schimb de lucru',
        description: 'Actualizează datele unui schimb de lucru existent cu validare de conflicte.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul schimbului de lucru', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Schimbul a fost actualizat cu succes',
        type: shift_entity_1.Shift,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Schimbul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CONFLICT,
        description: 'Există conflict cu alt schimb programat',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_shift_dto_1.UpdateShiftDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "updateShift", null);
__decorate([
    (0, common_1.Delete)('shifts/:id'),
    (0, permissions_decorator_1.Permissions)('attendance.delete'),
    (0, swagger_1.ApiOperation)({
        summary: 'Șterge un schimb de lucru',
        description: 'Șterge definitiv un schimb de lucru și toate prezențele asociate.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul schimbului de lucru', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NO_CONTENT,
        description: 'Schimbul a fost șters cu succes',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Schimbul nu a fost găsit',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "deleteShift", null);
__decorate([
    (0, common_1.Post)('presences'),
    (0, permissions_decorator_1.Permissions)('presence.create'),
    (0, swagger_1.ApiOperation)({
        summary: 'Înregistrează o nouă prezență',
        description: 'Creează o înregistrare de prezență pentru un schimb cu calculare automată a orelor lucrate.',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Prezența a fost înregistrată cu succes',
        type: presence_entity_1.Presence,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide pentru prezență',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CONFLICT,
        description: 'Există deja o prezență pentru această dată și schimb',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_presence_dto_1.CreatePresenceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createPresence", null);
__decorate([
    (0, common_1.Get)('presences'),
    (0, permissions_decorator_1.Permissions)('presence.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Listează toate prezențele',
        description: 'Returnează o listă paginată cu toate prezențele cu opțiuni avansate de filtrare.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, description: 'Numărul paginii', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 }),
    (0, swagger_1.ApiQuery)({ name: 'shift_id', required: false, description: 'Filtrare după ID-ul schimbului', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: presence_entity_1.PresenceStatus, description: 'Filtrare după status' }),
    (0, swagger_1.ApiQuery)({ name: 'start_date', required: false, description: 'Data de început (YYYY-MM-DD)', example: '2024-01-01' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', required: false, description: 'Data de sfârșit (YYYY-MM-DD)', example: '2024-01-31' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista prezențelor a fost returnată cu succes',
    }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('shift_id')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('start_date')),
    __param(5, (0, common_1.Query)('end_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "findAllPresences", null);
__decorate([
    (0, common_1.Get)('presences/:id'),
    (0, permissions_decorator_1.Permissions)('presence.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține o prezență după ID',
        description: 'Returnează detaliile complete ale unei prezențe inclusiv punctele de inflexiune.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul prezenței', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Prezența a fost găsită cu succes',
        type: presence_entity_1.Presence,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Prezența nu a fost găsită',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "findPresenceById", null);
__decorate([
    (0, common_1.Patch)('presences/:id'),
    (0, permissions_decorator_1.Permissions)('presence.update'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizează o prezență',
        description: 'Actualizează datele unei prezențe existente cu recalculare automată a orelor.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul prezenței', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Prezența a fost actualizată cu succes',
        type: presence_entity_1.Presence,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Prezența nu a fost găsită',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_presence_dto_1.UpdatePresenceDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "updatePresence", null);
__decorate([
    (0, common_1.Delete)('presences/:id'),
    (0, permissions_decorator_1.Permissions)('presence.delete'),
    (0, swagger_1.ApiOperation)({
        summary: 'Șterge o prezență',
        description: 'Șterge definitiv o prezență și toate punctele de inflexiune asociate.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul prezenței', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NO_CONTENT,
        description: 'Prezența a fost ștearsă cu succes',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Prezența nu a fost găsită',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "deletePresence", null);
__decorate([
    (0, common_1.Post)('presence-inflexions'),
    (0, permissions_decorator_1.Permissions)('presence-inflexion.create'),
    (0, swagger_1.ApiOperation)({
        summary: 'Înregistrează un punct de inflexiune',
        description: 'Creează un punct de inflexiune (ieșire/intrare) pentru o prezență cu coordonate GPS.',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Punctul de inflexiune a fost înregistrat cu succes',
        type: presence_inflexion_entity_1.PresenceInflexion,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide pentru punctul de inflexiune',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Prezența asociată nu a fost găsită',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_presence_inflexion_dto_1.CreatePresenceInflexionDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "createPresenceInflexion", null);
__decorate([
    (0, common_1.Get)('presence-inflexions'),
    (0, permissions_decorator_1.Permissions)('presence-inflexion.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Listează toate punctele de inflexiune',
        description: 'Returnează o listă paginată cu toate punctele de inflexiune cu opțiuni de filtrare.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, description: 'Numărul paginii', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 }),
    (0, swagger_1.ApiQuery)({ name: 'presence_id', required: false, description: 'Filtrare după ID-ul prezenței', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, enum: presence_inflexion_entity_1.InflexionType, description: 'Filtrare după tip (exit/entry)' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista punctelor de inflexiune a fost returnată cu succes',
    }),
    __param(0, (0, common_1.Query)('page', new common_1.ParseIntPipe({ optional: true }))),
    __param(1, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('presence_id', new common_1.ParseIntPipe({ optional: true }))),
    __param(3, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "findAllPresenceInflexions", null);
__decorate([
    (0, common_1.Get)('presence-inflexions/:id'),
    (0, permissions_decorator_1.Permissions)('presence-inflexion.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține un punct de inflexiune după ID',
        description: 'Returnează detaliile complete ale unui punct de inflexiune inclusiv datele GPS.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul punctului de inflexiune', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Punctul de inflexiune a fost găsit cu succes',
        type: presence_inflexion_entity_1.PresenceInflexion,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Punctul de inflexiune nu a fost găsit',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "findPresenceInflexionById", null);
__decorate([
    (0, common_1.Patch)('presence-inflexions/:id'),
    (0, permissions_decorator_1.Permissions)('presence-inflexion.update'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizează un punct de inflexiune',
        description: 'Actualizează datele unui punct de inflexiune existent.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul punctului de inflexiune', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Punctul de inflexiune a fost actualizat cu succes',
        type: presence_inflexion_entity_1.PresenceInflexion,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Punctul de inflexiune nu a fost găsit',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_presence_inflexion_dto_1.UpdatePresenceInflexionDto]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "updatePresenceInflexion", null);
__decorate([
    (0, common_1.Delete)('presence-inflexions/:id'),
    (0, permissions_decorator_1.Permissions)('presence-inflexion.delete'),
    (0, swagger_1.ApiOperation)({
        summary: 'Șterge un punct de inflexiune',
        description: 'Șterge definitiv un punct de inflexiune.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul punctului de inflexiune', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NO_CONTENT,
        description: 'Punctul de inflexiune a fost șters cu succes',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Punctul de inflexiune nu a fost găsit',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "deletePresenceInflexion", null);
__decorate([
    (0, common_1.Get)('statistics'),
    (0, permissions_decorator_1.Permissions)('attendance.read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține statistici de prezență',
        description: 'Generează rapoarte și statistici detaliate despre prezența angajaților.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'employee_id', required: false, description: 'Filtrare după ID-ul angajatului', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'start_date', required: false, description: 'Data de început (YYYY-MM-DD)', example: '2024-01-01' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', required: false, description: 'Data de sfârșit (YYYY-MM-DD)', example: '2024-01-31' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statisticile au fost generate cu succes',
    }),
    __param(0, (0, common_1.Query)('employee_id', new common_1.ParseIntPipe({ optional: true }))),
    __param(1, (0, common_1.Query)('start_date')),
    __param(2, (0, common_1.Query)('end_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "getAttendanceStatistics", null);
exports.AttendanceController = AttendanceController = __decorate([
    (0, swagger_1.ApiTags)('attendance'),
    (0, common_1.Controller)('attendance'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiExtraModels)(shift_entity_1.Shift, presence_entity_1.Presence, presence_inflexion_entity_1.PresenceInflexion),
    __metadata("design:paramtypes", [attendance_service_1.AttendanceService])
], AttendanceController);
//# sourceMappingURL=attendance.controller.js.map
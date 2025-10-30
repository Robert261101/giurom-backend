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
exports.CalendarController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const calendar_service_1 = require("./calendar.service");
const update_calendar_event_dto_1 = require("./dto/update-calendar-event.dto");
const create_recurrence_rule_dto_1 = require("./dto/create-recurrence-rule.dto");
const filter_calendar_events_dto_1 = require("./dto/filter-calendar-events.dto");
const calendar_event_entity_1 = require("./entities/calendar-event.entity");
const recurrence_rule_entity_1 = require("./entities/recurrence-rule.entity");
let CalendarController = class CalendarController {
    constructor(calendarService) {
        this.calendarService = calendarService;
    }
    createRecurrenceRule(createRecurrenceRuleDto) {
        return this.calendarService.createRecurrenceRule(createRecurrenceRuleDto);
    }
    findAllRecurrenceRules() {
        return this.calendarService.findAllRecurrenceRules();
    }
    findRecurrenceRule(id) {
        return this.calendarService.findRecurrenceRule(id);
    }
    createEvent(body, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        const createCalendarEventDto = 'event' in body ? body.event : body;
        return this.calendarService.createEvent(createCalendarEventDto, userId);
    }
    findEvents(filters, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.calendarService.findEvents(filters, userId);
    }
    findOne(id, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.calendarService.findOne(id, userId);
    }
    updateEvent(id, updateCalendarEventDto, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.calendarService.updateEvent(id, updateCalendarEventDto, userId);
    }
    updateRecurrenceEndDate(id, endDate, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.calendarService.updateRecurrenceEndDate(id, endDate, userId);
    }
    removeEvent(id, currentUserId) {
        const userId = currentUserId ? parseInt(currentUserId) : undefined;
        return this.calendarService.removeEvent(id, userId);
    }
    generateRecurringEvents(id, startDate, endDate) {
        return this.calendarService.generateRecurringEvents(id, new Date(startDate), new Date(endDate));
    }
};
exports.CalendarController = CalendarController;
__decorate([
    (0, common_1.Post)('recurrence-rules'),
    (0, swagger_1.ApiOperation)({ summary: 'Creează o regulă de recurență pentru evenimente' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Regula de recurență a fost creată cu succes',
        type: recurrence_rule_entity_1.RecurrenceRule,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide pentru regula de recurență',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_recurrence_rule_dto_1.CreateRecurrenceRuleDto]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "createRecurrenceRule", null);
__decorate([
    (0, common_1.Get)('recurrence-rules'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține toate regulile de recurență' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista regulilor de recurență',
        type: [recurrence_rule_entity_1.RecurrenceRule],
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "findAllRecurrenceRules", null);
__decorate([
    (0, common_1.Get)('recurrence-rules/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține o regulă de recurență specifică' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul regulii de recurență' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Regula de recurență găsită',
        type: recurrence_rule_entity_1.RecurrenceRule,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Regula de recurență nu a fost găsită',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "findRecurrenceRule", null);
__decorate([
    (0, common_1.Post)('events'),
    (0, swagger_1.ApiOperation)({ summary: 'Creează un eveniment în calendar' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Evenimentul a fost creat cu succes',
        type: calendar_event_entity_1.CalendarEvent,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide pentru eveniment',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Angajatul creator sau regula de recurență nu a fost găsită',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să creezi evenimente pentru alți utilizatori',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Get)('events'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține evenimente din calendar cu filtrare opțională' }),
    (0, swagger_1.ApiQuery)({ name: 'start_date', required: false, description: 'Data de început pentru filtrare (ISO format)' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', required: false, description: 'Data de sfârșit pentru filtrare (ISO format)' }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false, description: 'Categoria evenimentelor' }),
    (0, swagger_1.ApiQuery)({ name: 'created_by', required: false, description: 'ID-ul creatorului evenimentelor' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, description: 'Căutare în titlu sau descriere' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista evenimentelor filtrate',
        type: [calendar_event_entity_1.CalendarEvent],
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [filter_calendar_events_dto_1.FilterCalendarEventsDto, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "findEvents", null);
__decorate([
    (0, common_1.Get)('events/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obține detaliile unui eveniment specific' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul evenimentului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Evenimentul găsit',
        type: calendar_event_entity_1.CalendarEvent,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Evenimentul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să vezi acest eveniment',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('events/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifică un eveniment din calendar' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul evenimentului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Evenimentul a fost modificat cu succes',
        type: calendar_event_entity_1.CalendarEvent,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Evenimentul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să modifici acest eveniment',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.BAD_REQUEST,
        description: 'Date invalide pentru actualizare',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_calendar_event_dto_1.UpdateCalendarEventDto, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "updateEvent", null);
__decorate([
    (0, common_1.Patch)('events/:id/recurrence-end-date'),
    (0, swagger_1.ApiOperation)({ summary: 'Oprește recurența pentru evenimentul de bază începând cu o dată' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul evenimentului de bază' }),
    (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.OK, description: 'Recurența a fost oprită' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('endDate')),
    __param(2, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "updateRecurrenceEndDate", null);
__decorate([
    (0, common_1.Delete)('events/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Șterge un eveniment din calendar' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul evenimentului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NO_CONTENT,
        description: 'Evenimentul a fost șters cu succes',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Evenimentul nu a fost găsit',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FORBIDDEN,
        description: 'Nu ai permisiunea să ștergi acest eveniment',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "removeEvent", null);
__decorate([
    (0, common_1.Get)('recurrence-rules/:id/generate-events'),
    (0, swagger_1.ApiOperation)({ summary: 'Generează evenimente pe baza unei reguli de recurență' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul regulii de recurență' }),
    (0, swagger_1.ApiQuery)({ name: 'start_date', description: 'Data de început pentru generare (ISO format)' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', description: 'Data de sfârșit pentru generare (ISO format)' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Evenimente generate pe baza regulii de recurență',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Regula de recurență nu a fost găsită',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('start_date')),
    __param(2, (0, common_1.Query)('end_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "generateRecurringEvents", null);
exports.CalendarController = CalendarController = __decorate([
    (0, swagger_1.ApiTags)('calendar'),
    (0, common_1.Controller)('calendar'),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [calendar_service_1.CalendarService])
], CalendarController);
//# sourceMappingURL=calendar.controller.js.map
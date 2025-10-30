"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const typeorm_1 = require("@nestjs/typeorm");
const calendar_event_entity_1 = require("./entities/calendar-event.entity");
const recurrence_rule_entity_1 = require("./entities/recurrence-rule.entity");
const shift_change_requests_entity_1 = require("./entities/shift-change-requests.entity");
const leave_request_entity_1 = require("./entities/leave-request.entity");
const calendar_service_1 = require("./calendar.service");
const calendar_controller_1 = require("./calendar.controller");
const calendar_micro_controller_1 = require("./calendar.micro.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: [(0, path_1.join)(__dirname, '..', '.env')] }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                entities: [
                    calendar_event_entity_1.CalendarEvent,
                    recurrence_rule_entity_1.RecurrenceRule,
                    shift_change_requests_entity_1.ShiftChangeRequests,
                    leave_request_entity_1.LeaveRequest,
                ],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
                charset: 'utf8mb4',
            }),
            typeorm_1.TypeOrmModule.forFeature([calendar_event_entity_1.CalendarEvent, recurrence_rule_entity_1.RecurrenceRule, shift_change_requests_entity_1.ShiftChangeRequests, leave_request_entity_1.LeaveRequest]),
        ],
        controllers: [calendar_controller_1.CalendarController, calendar_micro_controller_1.CalendarMicroController],
        providers: [calendar_service_1.CalendarService],
        exports: [calendar_service_1.CalendarService, typeorm_1.TypeOrmModule],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
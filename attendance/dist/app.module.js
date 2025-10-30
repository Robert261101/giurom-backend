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
const microservices_1 = require("@nestjs/microservices");
const typeorm_1 = require("@nestjs/typeorm");
const shift_entity_1 = require("./entities/shift.entity");
const presence_entity_1 = require("./entities/presence.entity");
const presence_inflexion_entity_1 = require("./entities/presence-inflexion.entity");
const attendance_service_1 = require("./attendance.service");
const auth_module_1 = require("./auth/auth.module");
const core_1 = require("@nestjs/core");
const jwt_auth_guard_1 = require("./auth/jwt-auth.guard");
const permissions_guard_1 = require("./permissions/permissions.guard");
const attendance_controller_1 = require("./attendance.controller");
const attendance_micro_controller_1 = require("./attendance.micro.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: [(0, path_1.join)(__dirname, '..', '.env')] }),
            microservices_1.ClientsModule.register([
                {
                    name: 'NOTIFICATIONS_RMQ',
                    transport: microservices_1.Transport.RMQ,
                    options: {
                        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
                        queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
                        queueOptions: { durable: false },
                    },
                },
            ]),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                entities: [
                    shift_entity_1.Shift,
                    presence_entity_1.Presence,
                    presence_inflexion_entity_1.PresenceInflexion,
                ],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
                charset: 'utf8mb4',
            }),
            typeorm_1.TypeOrmModule.forFeature([
                shift_entity_1.Shift,
                presence_entity_1.Presence,
                presence_inflexion_entity_1.PresenceInflexion,
            ]),
        ],
        controllers: [attendance_controller_1.AttendanceController, attendance_micro_controller_1.AttendanceMicroController],
        providers: [
            attendance_service_1.AttendanceService,
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: permissions_guard_1.PermissionsGuard },
        ],
        exports: [attendance_service_1.AttendanceService, typeorm_1.TypeOrmModule],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
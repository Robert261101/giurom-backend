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
const waste_record_entity_1 = require("./waste-records/entities/waste-record.entity");
const waste_records_service_1 = require("./waste-records/waste-records.service");
const waste_records_micro_controller_1 = require("./waste-records.micro.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: [(0, path_1.join)(__dirname, '..', '.env')] }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mariadb',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                entities: [waste_record_entity_1.WasteRecord],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
                charset: 'utf8mb4',
                timezone: '+00:00',
                extra: {
                    connectionLimit: 10,
                    acquireTimeout: 60000,
                    timeout: 60000,
                    reconnect: true,
                    charset: 'utf8mb4',
                    initStatements: [
                        "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
                        'SET CHARACTER SET utf8mb4',
                        'SET character_set_connection=utf8mb4',
                    ],
                },
            }),
            typeorm_1.TypeOrmModule.forFeature([waste_record_entity_1.WasteRecord]),
        ],
        controllers: [waste_records_micro_controller_1.WasteRecordsMicroController],
        providers: [waste_records_service_1.WasteRecordsService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
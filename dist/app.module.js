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
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const employee_micro_controller_1 = require("./employee.micro.controller");
const employee_http_controller_1 = require("./employee.http.controller");
const employee_service_1 = require("./employee.service");
const employee_entity_1 = require("./entities/employee.entity");
const employee_work_location_history_entity_1 = require("./entities/employee-work-location-history.entity");
const employee_files_entity_1 = require("./entities/employee-files.entity");
const generated_documents_entity_1 = require("./entities/generated-documents.entity");
const employee_location_entity_1 = require("./entities/employee-location.entity");
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
                entities: [employee_entity_1.Employee, employee_work_location_history_entity_1.EmployeeWorkLocationHistory, employee_files_entity_1.EmployeeFiles, generated_documents_entity_1.GeneratedDocuments, employee_location_entity_1.EmployeeLocation],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
            }),
            typeorm_1.TypeOrmModule.forFeature([
                employee_entity_1.Employee,
                employee_work_location_history_entity_1.EmployeeWorkLocationHistory,
                employee_files_entity_1.EmployeeFiles,
                generated_documents_entity_1.GeneratedDocuments,
                employee_location_entity_1.EmployeeLocation,
            ]),
        ],
        controllers: [employee_micro_controller_1.EmployeeMicroController, employee_http_controller_1.EmployeeHttpController],
        providers: [employee_service_1.EmployeeService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
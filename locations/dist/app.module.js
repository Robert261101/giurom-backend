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
const work_location_entity_1 = require("./locations/entity/work-location.entity");
const work_location_task_template_entity_1 = require("./locations/entity/work-location-task-template.entity");
const work_location_departments_entity_1 = require("./locations/entity/work-location-departments.entity");
const work_location_department_positions_entity_1 = require("./locations/entity/work-location-department-positions.entity");
const work_location_revenue_entity_1 = require("./locations/entity/work-location-revenue.entity");
const work_location_revenue_points_entity_1 = require("./locations/entity/work-location-revenue-points.entity");
const work_location_manager_config_entity_1 = require("./locations/entity/work-location-manager-config.entity");
const locations_service_1 = require("./locations/locations.service");
const locations_micro_controller_1 = require("./locations.micro.controller");
const locations_http_controller_1 = require("./locations.http.controller");
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
                entities: [
                    work_location_entity_1.WorkLocation,
                    work_location_task_template_entity_1.WorkLocationTaskTemplate,
                    work_location_departments_entity_1.WorkLocationDepartments,
                    work_location_department_positions_entity_1.WorkLocationDepartmentPositions,
                    work_location_revenue_entity_1.WorkLocationRevenue,
                    work_location_revenue_points_entity_1.WorkLocationRevenuePoints,
                    work_location_manager_config_entity_1.WorkLocationManagerConfig,
                ],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
                charset: 'utf8mb4',
                timezone: '+00:00',
            }),
            typeorm_1.TypeOrmModule.forFeature([
                work_location_entity_1.WorkLocation,
                work_location_task_template_entity_1.WorkLocationTaskTemplate,
                work_location_departments_entity_1.WorkLocationDepartments,
                work_location_department_positions_entity_1.WorkLocationDepartmentPositions,
                work_location_revenue_entity_1.WorkLocationRevenue,
                work_location_revenue_points_entity_1.WorkLocationRevenuePoints,
                work_location_manager_config_entity_1.WorkLocationManagerConfig,
            ]),
        ],
        controllers: [locations_micro_controller_1.LocationsMicroController, locations_http_controller_1.LocationsHttpController],
        providers: [locations_service_1.LocationsService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftChangeRequestsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("@nestjs/axios");
const shift_change_requests_controller_1 = require("./shift-change-requests.controller");
const shift_change_requests_service_1 = require("./shift-change-requests.service");
const shift_change_request_entity_1 = require("./entities/shift-change-request.entity");
let ShiftChangeRequestsModule = class ShiftChangeRequestsModule {
};
exports.ShiftChangeRequestsModule = ShiftChangeRequestsModule;
exports.ShiftChangeRequestsModule = ShiftChangeRequestsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            typeorm_1.TypeOrmModule.forFeature([
                shift_change_request_entity_1.ShiftChangeRequest,
            ]),
        ],
        controllers: [shift_change_requests_controller_1.ShiftChangeRequestsController],
        providers: [shift_change_requests_service_1.ShiftChangeRequestsService],
        exports: [shift_change_requests_service_1.ShiftChangeRequestsService, typeorm_1.TypeOrmModule],
    })
], ShiftChangeRequestsModule);
//# sourceMappingURL=shift-change-requests.module.js.map
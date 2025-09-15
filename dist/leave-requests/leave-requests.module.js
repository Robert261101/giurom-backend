"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveRequestsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("@nestjs/axios");
const leave_requests_controller_1 = require("./leave-requests.controller");
const leave_requests_service_1 = require("./leave-requests.service");
const leave_request_entity_1 = require("./entities/leave-request.entity");
let LeaveRequestsModule = class LeaveRequestsModule {
};
exports.LeaveRequestsModule = LeaveRequestsModule;
exports.LeaveRequestsModule = LeaveRequestsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            typeorm_1.TypeOrmModule.forFeature([
                leave_request_entity_1.LeaveRequest,
            ]),
        ],
        controllers: [leave_requests_controller_1.LeaveRequestsController],
        providers: [leave_requests_service_1.LeaveRequestsService],
        exports: [leave_requests_service_1.LeaveRequestsService, typeorm_1.TypeOrmModule],
    })
], LeaveRequestsModule);
//# sourceMappingURL=leave-requests.module.js.map
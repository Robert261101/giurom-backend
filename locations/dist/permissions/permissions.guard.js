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
var PermissionsGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("typeorm");
const axios_1 = require("axios");
const permissions_decorator_1 = require("./permissions.decorator");
let PermissionsGuard = PermissionsGuard_1 = class PermissionsGuard {
    constructor(reflector, dataSource) {
        this.reflector = reflector;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(PermissionsGuard_1.name);
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.bypassAuth) {
            this.logger.log('Bypassing permissions check for internal service request');
            return true;
        }
        const handler = context.getHandler();
        const controller = context.getClass();
        const handlerName = handler.name;
        this.logger.log(`🔍 [PermissionsGuard] Handler name: ${handlerName}, Controller: ${controller.name}`);
        const requiredPermissions = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [
            handler,
            controller,
        ]);
        const handlerPermissions = this.reflector.get(permissions_decorator_1.PERMISSIONS_KEY, handler);
        const classPermissions = this.reflector.get(permissions_decorator_1.PERMISSIONS_KEY, controller);
        this.logger.log(`🔍 [PermissionsGuard] Handler permissions: ${JSON.stringify(handlerPermissions)}`);
        this.logger.log(`🔍 [PermissionsGuard] Class permissions: ${JSON.stringify(classPermissions)}`);
        this.logger.log(`🔍 [PermissionsGuard] Final required permissions (getAllAndOverride): ${JSON.stringify(requiredPermissions)}`);
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }
        if (request.bypassAuth === true) {
            return true;
        }
        const user = request?.user;
        if (!user) {
            this.logger.warn('User not authenticated');
            throw new common_1.ForbiddenException('Fără permisiuni');
        }
        const path = request.path || request.url?.split('?')[0] || '';
        const isGetRequest = request.method === 'GET';
        const hasAll = user.permissions && requiredPermissions.every((perm) => user.permissions.includes(perm));
        this.logger.log(`🔍 [PermissionsGuard] Checking permissions for ${request.method} ${path}`);
        this.logger.log(`🔍 [PermissionsGuard] Required permissions: ${JSON.stringify(requiredPermissions)}`);
        this.logger.log(`🔍 [PermissionsGuard] User permissions count: ${user.permissions?.length || 0}`);
        this.logger.log(`🔍 [PermissionsGuard] User has cashing.create: ${user.permissions?.includes('cashing.create') || false}`);
        if (user.permissions && user.permissions.length > 0) {
            this.logger.log(`🔍 [PermissionsGuard] First 10 user permissions: ${JSON.stringify(user.permissions.slice(0, 10))}`);
        }
        this.logger.log(`🔍 [PermissionsGuard] Has all required permissions: ${hasAll}`);
        if (hasAll) {
            this.logger.log(`✅ User has all required permissions: ${requiredPermissions.join(', ')}`);
            return true;
        }
        const isRevenueEndpoint = path.includes('/revenue/') && (request.method === 'PATCH' || request.method === 'DELETE');
        if (isRevenueEndpoint) {
            if (!user.permissions) {
                this.logger.warn('User has no permissions for revenue endpoint');
                throw new common_1.ForbiddenException('Fără permisiuni');
            }
            this.logger.warn(`User missing required permissions for revenue endpoint: ${requiredPermissions.join(', ')}`);
            throw new common_1.ForbiddenException('Permisiuni insuficiente');
        }
        let locationId = request.params?.id || request.params?.locationId;
        if (!locationId && path) {
            const match = path.match(/\/locations\/(\d+)/);
            if (match) {
                locationId = match[1];
            }
        }
        const employeeId = user.id || user.employee_id || user.userId;
        const userWorkLocationId = user.work_location_id;
        this.logger.log(`🔍 Checking location access - isGetRequest: ${isGetRequest}, locationId: ${locationId}, employeeId: ${employeeId}, work_location_id: ${userWorkLocationId}, work_location_default_id: ${user.work_location_default_id}, path: ${path}, params: ${JSON.stringify(request.params)}`);
        const isLocationsListRequest = isGetRequest && !locationId && (path === '/locations' ||
            path === '/locations/' ||
            path.startsWith('/locations?') ||
            (path.startsWith('/locations') && !path.match(/\/locations\/\d+/)));
        if (isLocationsListRequest) {
            this.logger.log(`✅ Allowing GET /locations for authenticated user (employee ID ${employeeId}) - service will filter locations`);
            return true;
        }
        if (isGetRequest && locationId && employeeId) {
            this.logger.log(`🔍 Checking access to location ${locationId} for employee ${employeeId}`);
            const workLocationId = user.work_location_id || user.work_location_default_id;
            if (workLocationId && String(locationId) === String(workLocationId)) {
                this.logger.log(`✅ User accessing own location via work_location_id/work_location_default_id (location ID ${workLocationId})`);
                return true;
            }
            try {
                const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
                const response = await axios_1.default.get(`${employeesUrl}/employees/${employeeId}/locations`, {
                    headers: {
                        'x-internal-service': 'locations',
                        'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                        'Content-Type': 'application/json',
                    },
                    timeout: 3000,
                });
                const employeeLocations = Array.isArray(response.data) ? response.data : [];
                const locationIdNum = parseInt(locationId, 10);
                const hasAccess = employeeLocations.some((el) => {
                    const elLocationId = el.idLocation || el.id_location || el.locationId || el.location_id;
                    return elLocationId === locationIdNum || String(elLocationId) === String(locationId);
                });
                if (hasAccess) {
                    this.logger.log(`✅ User accessing own location via employees_locations (employee ID ${employeeId}, location ID ${locationId})`);
                    return true;
                }
                else {
                    this.logger.warn(`❌ Location ${locationId} not found in employee ${employeeId} locations list`);
                }
            }
            catch (error) {
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                    try {
                        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
                        const result = await this.dataSource.query(`SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ? AND id_location = ?`, [employeeId, locationId]);
                        if (result && result.length > 0) {
                            this.logger.log(`✅ Found location ${locationId} in employees_locations via direct DB query for employee ${employeeId}`);
                            return true;
                        }
                        else {
                            this.logger.warn(`❌ Location ${locationId} not found in employees_locations for employee ${employeeId}`);
                        }
                    }
                    catch (dbError) {
                        this.logger.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
                    }
                }
                else {
                    this.logger.error(`❌ Failed to check employee location access: ${error.message} (code: ${error.code || 'unknown'})`);
                }
            }
        }
        if (!user.permissions) {
            this.logger.warn('User has no permissions');
            throw new common_1.ForbiddenException('Fără permisiuni');
        }
        this.logger.warn(`User missing required permissions: ${requiredPermissions.join(', ')}`);
        throw new common_1.ForbiddenException('Permisiuni insuficiente');
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = PermissionsGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(typeorm_1.DataSource)),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_1.DataSource])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map
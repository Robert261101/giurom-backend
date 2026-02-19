"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var InternalServiceGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServiceGuard = void 0;
const common_1 = require("@nestjs/common");
let InternalServiceGuard = InternalServiceGuard_1 = class InternalServiceGuard {
    constructor() {
        this.logger = new common_1.Logger(InternalServiceGuard_1.name);
    }
    canActivate(context) {
        if (context.getType() === 'rpc') {
            const rpcContext = context.switchToRpc();
            const data = rpcContext.getData();
            const internalService = data?.headers?.['x-internal-service'] || data?.['x-internal-service'];
            const serviceSecret = data?.headers?.['x-service-secret'] || data?.['x-service-secret'];
            this.logger.log(`Internal service headers (RPC) - Service: ${internalService}, Secret present: ${!!serviceSecret}`);
            if (internalService && serviceSecret) {
                const expectedSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                this.logger.log(`Expected secret: ${expectedSecret}, Provided secret: ${serviceSecret}`);
                if (serviceSecret === expectedSecret) {
                    this.logger.log(`Internal service request allowed for service: ${internalService} (RPC)`);
                    return true;
                }
                else {
                    this.logger.warn(`Invalid service secret provided for service: ${internalService} (RPC)`);
                    throw new common_1.UnauthorizedException('Invalid service secret');
                }
            }
            this.logger.log('No internal service headers found, allowing RPC request');
            return true;
        }
        const request = context.switchToHttp().getRequest();
        if (!request || !request.headers) {
            this.logger.log('No request or headers found, allowing HTTP request');
            return true;
        }
        const internalService = request.headers['x-internal-service'];
        const serviceSecret = request.headers['x-service-secret'];
        this.logger.log(`Internal service headers (HTTP) - Service: ${internalService}, Secret present: ${!!serviceSecret}`);
        if (internalService && serviceSecret) {
            const expectedSecret = process.env.SERVICE_SECRET || 'default-service-secret';
            this.logger.log(`Expected secret: ${expectedSecret}, Provided secret: ${serviceSecret}`);
            if (serviceSecret === expectedSecret) {
                request.internalService = internalService;
                request.bypassAuth = true;
                this.logger.log(`Internal service request allowed for service: ${internalService} (HTTP)`);
                return true;
            }
            else {
                this.logger.warn(`Invalid service secret provided for service: ${internalService} (HTTP)`);
                throw new common_1.UnauthorizedException('Invalid service secret');
            }
        }
        this.logger.log('No internal service headers found, allowing other guards to handle HTTP request');
        return true;
    }
};
exports.InternalServiceGuard = InternalServiceGuard;
exports.InternalServiceGuard = InternalServiceGuard = InternalServiceGuard_1 = __decorate([
    (0, common_1.Injectable)()
], InternalServiceGuard);
//# sourceMappingURL=internal-service.guard.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantScopeViolationError = void 0;
class TenantScopeViolationError extends Error {
    constructor(message) {
        super(message);
        this.code = 'TENANT_SCOPE_VIOLATION';
        this.name = 'TenantScopeViolationError';
    }
}
exports.TenantScopeViolationError = TenantScopeViolationError;
//# sourceMappingURL=tenant-access.errors.js.map
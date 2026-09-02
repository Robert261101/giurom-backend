"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveJwtCompanyId = exports.isTenantScopedSupplierRequester = exports.isTenantScopedRequester = exports.isPlatformSubscriptionAdmin = exports.hasPlatformWideSupplierAccess = exports.hasPlatformWideAccess = exports.assertTenantCompanyId = exports.TenantScopeViolationError = void 0;
var tenant_access_errors_1 = require("./tenant-access.errors");
Object.defineProperty(exports, "TenantScopeViolationError", { enumerable: true, get: function () { return tenant_access_errors_1.TenantScopeViolationError; } });
var tenant_access_1 = require("./tenant-access");
Object.defineProperty(exports, "assertTenantCompanyId", { enumerable: true, get: function () { return tenant_access_1.assertTenantCompanyId; } });
Object.defineProperty(exports, "hasPlatformWideAccess", { enumerable: true, get: function () { return tenant_access_1.hasPlatformWideAccess; } });
Object.defineProperty(exports, "hasPlatformWideSupplierAccess", { enumerable: true, get: function () { return tenant_access_1.hasPlatformWideSupplierAccess; } });
Object.defineProperty(exports, "isPlatformSubscriptionAdmin", { enumerable: true, get: function () { return tenant_access_1.isPlatformSubscriptionAdmin; } });
Object.defineProperty(exports, "isTenantScopedRequester", { enumerable: true, get: function () { return tenant_access_1.isTenantScopedRequester; } });
Object.defineProperty(exports, "isTenantScopedSupplierRequester", { enumerable: true, get: function () { return tenant_access_1.isTenantScopedSupplierRequester; } });
Object.defineProperty(exports, "resolveJwtCompanyId", { enumerable: true, get: function () { return tenant_access_1.resolveJwtCompanyId; } });
//# sourceMappingURL=index.js.map
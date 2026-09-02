"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTenantScopedSupplierRequester = exports.hasPlatformWideSupplierAccess = void 0;
exports.resolveJwtCompanyId = resolveJwtCompanyId;
exports.hasPlatformWideAccess = hasPlatformWideAccess;
exports.isTenantScopedRequester = isTenantScopedRequester;
exports.assertTenantCompanyId = assertTenantCompanyId;
exports.isPlatformSubscriptionAdmin = isPlatformSubscriptionAdmin;
const tenant_access_errors_1 = require("./tenant-access.errors");
function normalizeRoles(roles) {
    return (Array.isArray(roles) ? roles : []).map((role) => String(role).toLowerCase().trim());
}
function normalizePermissions(permissions) {
    return (Array.isArray(permissions) ? permissions : []).map((perm) => String(perm).toLowerCase().trim());
}
function hasSuperAdminRole(roles) {
    return roles.includes('super-admin') || roles.includes('superadmin');
}
function resolveJwtCompanyId(user) {
    if (!user)
        return null;
    const raw = user.company_id ?? user.companyId;
    const companyId = Number(raw);
    return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}
function hasPlatformWideAccess(user) {
    if (!user)
        return false;
    if (user.isSuperAdmin === true)
        return true;
    const roles = normalizeRoles(user.roles);
    if (hasSuperAdminRole(roles)) {
        return true;
    }
    const companyId = resolveJwtCompanyId(user);
    if (companyId != null) {
        return false;
    }
    const permissions = normalizePermissions(user.permissions);
    if (permissions.includes('assignment.read_all')) {
        return true;
    }
    if (roles.includes('admin')) {
        return true;
    }
    return false;
}
function isTenantScopedRequester(user) {
    if (!user)
        return false;
    if (hasPlatformWideAccess(user))
        return false;
    return resolveJwtCompanyId(user) != null;
}
function assertTenantCompanyId(user, dtoCompanyId) {
    if (hasPlatformWideAccess(user)) {
        const requested = Number(dtoCompanyId);
        if (!Number.isFinite(requested) || requested <= 0) {
            throw new tenant_access_errors_1.TenantScopeViolationError('ID-ul companiei este obligatoriu');
        }
        return requested;
    }
    const jwtCompanyId = resolveJwtCompanyId(user);
    if (jwtCompanyId == null) {
        throw new tenant_access_errors_1.TenantScopeViolationError('Compania utilizatorului nu este determinată');
    }
    if (dtoCompanyId != null && dtoCompanyId !== undefined) {
        const requested = Number(dtoCompanyId);
        if (Number.isFinite(requested) &&
            requested > 0 &&
            requested !== jwtCompanyId) {
            throw new tenant_access_errors_1.TenantScopeViolationError('Nu poți opera pe o companie diferită de tenant-ul autentificat');
        }
    }
    return jwtCompanyId;
}
function isPlatformSubscriptionAdmin(requester) {
    if (!requester)
        return false;
    if (resolveJwtCompanyId(requester) != null) {
        return false;
    }
    if (requester.isSuperAdmin === true)
        return true;
    if (requester.hasPlatformWideAccess === true)
        return true;
    const permissions = normalizePermissions(requester.permissions);
    if (permissions.includes('assignment.read_all'))
        return true;
    const roles = normalizeRoles(requester.roles);
    if (roles.includes('admin') || hasSuperAdminRole(roles)) {
        return true;
    }
    return false;
}
exports.hasPlatformWideSupplierAccess = hasPlatformWideAccess;
exports.isTenantScopedSupplierRequester = isTenantScopedRequester;
//# sourceMappingURL=tenant-access.js.map
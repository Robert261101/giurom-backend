import type { PlatformSubscriptionAdminRequester, TenantAccessUser } from './tenant-access.types';
export declare function resolveJwtCompanyId(user?: TenantAccessUser | null): number | null;
export declare function hasPlatformWideAccess(user?: TenantAccessUser | null): boolean;
export declare function isTenantScopedRequester(user?: TenantAccessUser | null): boolean;
export declare function assertTenantCompanyId(user?: TenantAccessUser | null, dtoCompanyId?: number | null): number;
export declare function isPlatformSubscriptionAdmin(requester?: PlatformSubscriptionAdminRequester | null): boolean;
export declare const hasPlatformWideSupplierAccess: typeof hasPlatformWideAccess;
export declare const isTenantScopedSupplierRequester: typeof isTenantScopedRequester;

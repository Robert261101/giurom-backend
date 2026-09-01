export type {
  PlatformSubscriptionAdminRequester,
  TenantAccessUser,
} from './tenant-access.types';

export { TenantScopeViolationError } from './tenant-access.errors';

export {
  assertTenantCompanyId,
  hasPlatformWideAccess,
  hasPlatformWideSupplierAccess,
  isPlatformSubscriptionAdmin,
  isTenantScopedRequester,
  isTenantScopedSupplierRequester,
  resolveJwtCompanyId,
} from './tenant-access';

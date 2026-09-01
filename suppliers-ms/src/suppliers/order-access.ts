import { ForbiddenException } from '@nestjs/common';
import {
  hasPlatformWideAccess,
  resolveJwtCompanyId,
} from '@giurom/tenant-access';

export type OrderRequesterUser = {
  company_id?: number | null;
  companyId?: number | null;
  company_type?: string | null;
  permissions?: string[];
  roles?: string[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  sub?: number;
  userId?: number;
  work_location_id?: number;
  work_location_default_id?: number;
};

export function resolveOrderActorUserId(
  user?: OrderRequesterUser,
): number | undefined {
  const raw = user?.sub ?? user?.userId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Platform-wide order access (canonical `@giurom/tenant-access` rules).
 * Bound `admin` / `assignment.read_all` + company_id => NOT platform.
 */
export function isPlatformOrderRequester(
  user?: OrderRequesterUser | null,
): boolean {
  if (!user) {
    return false;
  }
  return hasPlatformWideAccess(user);
}

/**
 * Tenant company for order reads/writes — exclusively from JWT.
 * Platform operators => null (no tenant binding).
 */
export function resolveOrderTenantCompanyId(
  user?: OrderRequesterUser | null,
): number | null {
  if (!user || isPlatformOrderRequester(user)) {
    return null;
  }
  return resolveJwtCompanyId(user);
}

/**
 * Reject when body/query `company_id` tries to scope another tenant.
 */
export function assertOrderCompanyIdNotEscalated(
  user?: OrderRequesterUser | null,
  requestedCompanyId?: number | null,
): void {
  if (requestedCompanyId == null) {
    return;
  }
  const tenantCompanyId = resolveOrderTenantCompanyId(user);
  if (tenantCompanyId == null) {
    return;
  }
  const requested = Number(requestedCompanyId);
  if (
    Number.isFinite(requested) &&
    requested > 0 &&
    requested !== tenantCompanyId
  ) {
    throw new ForbiddenException(
      'company_id nu aparține companiei dumneavoastră',
    );
  }
}

/**
 * Order-by-id / mutation gate.
 * Tenant: order.company_id must equal JWT company_id.
 * Platform: unrestricted.
 * Internal (no user): unrestricted.
 */
export function assertOrderCompanyAccess(
  order: { company_id?: number | null },
  user?: OrderRequesterUser,
): void {
  if (!user) {
    return;
  }
  if (isPlatformOrderRequester(user)) {
    return;
  }

  const tenantCompanyId = resolveOrderTenantCompanyId(user);
  const orderCompanyId = Number(order.company_id);

  if (
    tenantCompanyId == null ||
    !Number.isFinite(orderCompanyId) ||
    orderCompanyId <= 0 ||
    orderCompanyId !== tenantCompanyId
  ) {
    throw new ForbiddenException(
      'Comanda nu aparține companiei dumneavoastră',
    );
  }
}

export function orderBelongsToTenant(
  order: { company_id?: number | null },
  user?: OrderRequesterUser,
): boolean {
  if (!user) {
    return true;
  }
  if (isPlatformOrderRequester(user)) {
    return true;
  }
  const tenantCompanyId = resolveOrderTenantCompanyId(user);
  const orderCompanyId = Number(order.company_id);
  return (
    tenantCompanyId != null &&
    Number.isFinite(orderCompanyId) &&
    orderCompanyId > 0 &&
    orderCompanyId === tenantCompanyId
  );
}

export function filterOrdersByRequesterCompany<
  T extends { company_id?: number | null },
>(orders: T[], user?: OrderRequesterUser): T[] {
  if (!user) {
    return orders;
  }
  if (isPlatformOrderRequester(user)) {
    return orders;
  }
  const tenantCompanyId = resolveOrderTenantCompanyId(user);
  if (tenantCompanyId == null) {
    return [];
  }
  return orders.filter((order) => {
    const orderCompanyId = Number(order.company_id);
    return (
      Number.isFinite(orderCompanyId) &&
      orderCompanyId > 0 &&
      orderCompanyId === tenantCompanyId
    );
  });
}

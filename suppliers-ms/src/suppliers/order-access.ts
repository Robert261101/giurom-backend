import { ForbiddenException } from '@nestjs/common';
import {
  SupplierProductUserContext,
  buildSupplierProductUserContext,
  isAdminOrSuperAdminFromContext,
} from './supplier-product-access';

export type OrderRequesterUser = {
  company_id?: number | null;
  permissions?: string[];
  roles?: string[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  sub?: number;
  userId?: number;
};

export function resolveOrderActorUserId(
  user?: OrderRequesterUser,
): number | undefined {
  const raw = user?.sub ?? user?.userId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function assertOrderCompanyAccess(
  order: { company_id?: number | null },
  user?: SupplierProductUserContext,
): void {
  if (!user) {
    return;
  }
  if (isAdminOrSuperAdminFromContext(user)) {
    return;
  }
  const orderCompanyId = Number(order.company_id);
  const userCompanyId = user.companyId;
  if (
    userCompanyId != null &&
    Number.isFinite(orderCompanyId) &&
    orderCompanyId > 0 &&
    orderCompanyId !== userCompanyId
  ) {
    throw new ForbiddenException(
      'Comanda nu aparține companiei dumneavoastră',
    );
  }
}

export function filterOrdersByRequesterCompany<T extends { company_id?: number | null }>(
  orders: T[],
  user?: OrderRequesterUser,
): T[] {
  if (!user) {
    return orders;
  }
  const ctx = buildSupplierProductUserContext(user);
  if (isAdminOrSuperAdminFromContext(ctx)) {
    return orders;
  }
  const userCompanyId = ctx.companyId;
  if (userCompanyId == null) {
    return orders;
  }
  return orders.filter((order) => {
    const orderCompanyId = Number(order.company_id);
    if (!Number.isFinite(orderCompanyId) || orderCompanyId <= 0) {
      return true;
    }
    return orderCompanyId === userCompanyId;
  });
}

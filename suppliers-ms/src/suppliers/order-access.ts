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
  supplierOwnerCompanyId?: number | null,
): void {
  if (!user) {
    return;
  }
  if (isAdminOrSuperAdminFromContext(user)) {
    return;
  }
  const orderCompanyId = Number(order.company_id);
  const userCompanyId = user.companyId;
  const mismatchesClientCompany =
    userCompanyId != null &&
    Number.isFinite(orderCompanyId) &&
    orderCompanyId > 0 &&
    orderCompanyId !== userCompanyId;
  if (!mismatchesClientCompany) {
    return;
  }
  // Comanda nu e a companiei client a requester-ului — dar poate fi
  // requester-ul chiar compania furnizorului (ex: atribuire magazioner/șofer).
  const supplierCompanyId = Number(supplierOwnerCompanyId);
  if (
    userCompanyId != null &&
    Number.isFinite(supplierCompanyId) &&
    supplierCompanyId > 0 &&
    supplierCompanyId === userCompanyId
  ) {
    return;
  }
  throw new ForbiddenException(
    'Comanda nu aparține companiei dumneavoastră',
  );
}

export function filterOrdersByRequesterCompany<
  T extends {
    company_id?: number | null;
    supplier?: { owner_company_id?: number | null } | null;
  },
>(orders: T[], user?: OrderRequesterUser): T[] {
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
    if (orderCompanyId === userCompanyId) {
      return true;
    }
    // Requester poate fi compania furnizorului (ex: atribuire magazioner/șofer).
    const supplierCompanyId = Number(order.supplier?.owner_company_id);
    return (
      Number.isFinite(supplierCompanyId) &&
      supplierCompanyId > 0 &&
      supplierCompanyId === userCompanyId
    );
  });
}

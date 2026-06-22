import { ForbiddenException } from '@nestjs/common';

export interface SupplierProductUserContext {
  companyId: number | null;
  companyType: string | null;
  permissions: string[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export function buildSupplierProductUserContext(user?: {
  company_id?: number | null;
  company_type?: string | null;
  permissions?: string[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}): SupplierProductUserContext {
  const companyIdRaw = user?.company_id;
  const companyId =
    companyIdRaw != null && Number.isFinite(Number(companyIdRaw))
      ? Number(companyIdRaw)
      : null;
  return {
    companyId,
    companyType:
      typeof user?.company_type === 'string' ? user.company_type : null,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    isAdmin: user?.isAdmin === true,
    isSuperAdmin: user?.isSuperAdmin === true,
  };
}

export function isAdminOrSuperAdminFromPermissions(
  permissions: string[],
): boolean {
  return (
    permissions.includes('assignment.read_all') ||
    permissions.includes('assignment.read_company')
  );
}

export function isAdminOrSuperAdminFromContext(
  ctx: Pick<
    SupplierProductUserContext,
    'permissions' | 'isAdmin' | 'isSuperAdmin'
  >,
): boolean {
  if (ctx.isSuperAdmin || ctx.isAdmin) {
    return true;
  }
  return isAdminOrSuperAdminFromPermissions(ctx.permissions);
}

/** Doar admin/superadmin — configurare asociere nomenclator client. */
export function canManageSupplierProductClientMapping(
  ctx: Pick<
    SupplierProductUserContext,
    'permissions' | 'isAdmin' | 'isSuperAdmin'
  >,
): boolean {
  return isAdminOrSuperAdminFromContext(ctx);
}

/** Furnizor tenant may manage own nomenclature; admin/client may not. */
export function isFurnizorProductManager(ctx: SupplierProductUserContext): boolean {
  if (isAdminOrSuperAdminFromPermissions(ctx.permissions)) {
    return false;
  }
  return (
    ctx.companyType === 'furnizor' &&
    ctx.companyId != null &&
    Number.isFinite(ctx.companyId) &&
    ctx.companyId > 0
  );
}

export function assertFurnizorProductManager(ctx: SupplierProductUserContext): void {
  if (!isFurnizorProductManager(ctx)) {
    throw new ForbiddenException(
      'Doar conturile de tip furnizor pot gestiona nomenclatorul propriu de produse',
    );
  }
}

export function assertClientViewOnlyOnMutations(
  ctx: SupplierProductUserContext,
): void {
  if (isFurnizorProductManager(ctx)) {
    return;
  }
  throw new ForbiddenException(
    'Conturile admin/client pot doar vizualiza produsele furnizorului, nu le pot modifica',
  );
}

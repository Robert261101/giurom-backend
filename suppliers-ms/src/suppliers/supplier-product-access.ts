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
  roles?: string[];
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
    companyType: resolveCompanyTypeFromAuth(
      user?.company_type,
      user?.roles,
    ),
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    isAdmin: user?.isAdmin === true,
    isSuperAdmin: user?.isSuperAdmin === true,
  };
}

export interface SupplierAccessRequester {
  userId?: number;
  work_location_id?: number;
  work_location_default_id?: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
}

export function buildSupplierAccessRequester(user?: {
  userId?: number;
  work_location_id?: number;
  work_location_default_id?: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
}): SupplierAccessRequester {
  return {
    userId: Number.isFinite(Number(user?.userId)) ? Number(user?.userId) : undefined,
    work_location_id: Number.isFinite(Number(user?.work_location_id))
      ? Number(user?.work_location_id)
      : undefined,
    work_location_default_id: Number.isFinite(Number(user?.work_location_default_id))
      ? Number(user?.work_location_default_id)
      : undefined,
    isAdmin: user?.isAdmin === true,
    isSuperAdmin: user?.isSuperAdmin === true,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
  };
}

export function resolveCompanyTypeFromAuth(
  companyType: string | null | undefined,
  roles?: string[] | null,
): 'furnizor' | 'client' | null {
  const normalized =
    typeof companyType === 'string' ? companyType.toLowerCase().trim() : null;
  if (normalized === 'furnizor' || normalized === 'client') {
    return normalized;
  }
  const roleNames = Array.isArray(roles)
    ? roles.map((role) => String(role).toLowerCase().trim())
    : [];
  if (roleNames.includes('furnizor')) return 'furnizor';
  if (roleNames.includes('client')) return 'client';
  return null;
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

/**
 * Client-company admin (not furnizor tenant) who may manage the catalog of a
 * client-managed supplier (no authenticatable furnizor login). Service still
 * must check supplier association + hasSupplierLoginAccount === false.
 */
export function isClientAdminCatalogManager(
  ctx: SupplierProductUserContext,
): boolean {
  if (ctx.companyType === 'furnizor') {
    return false;
  }
  if (
    ctx.companyId == null ||
    !Number.isFinite(Number(ctx.companyId)) ||
    Number(ctx.companyId) <= 0
  ) {
    return false;
  }
  return isAdminOrSuperAdminFromContext(ctx);
}

/**
 * Client-managed catalog ownership: product belongs to the managed supplier.
 * `supplier_products.company_id` is the furnizor-tenant tag (nullable legacy),
 * not a client-company foreign key — accept null, the administering client,
 * or the supplier owner_company_id.
 */
export function isAllowedClientManagedProductCompany(
  productCompanyId: number | null | undefined,
  clientCompanyId: number,
  supplierOwnerCompanyId: number | null | undefined,
): boolean {
  const productCompany = Number(productCompanyId);
  if (!Number.isFinite(productCompany) || productCompany <= 0) {
    return true;
  }
  if (productCompany === Number(clientCompanyId)) {
    return true;
  }
  const ownerCompany = Number(supplierOwnerCompanyId);
  return (
    Number.isFinite(ownerCompany) &&
    ownerCompany > 0 &&
    productCompany === ownerCompany
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

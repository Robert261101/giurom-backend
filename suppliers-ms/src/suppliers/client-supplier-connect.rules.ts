/**
 * Pure decision helpers for POST /suppliers/connect (unit-tested).
 * HTTP mapping is done by SuppliersService.
 */

export type ConnectRejectReason =
  | 'forbidden_furnizor'
  | 'forbidden_no_company'
  | 'invalid_code'
  | 'self_link'
  | 'already_linked';

export function decideConnectAttempt(input: {
  companyType: 'furnizor' | 'client' | null;
  clientCompanyId: number | null;
  normalizedCode: string | null;
  supplier: {
    id: number;
    owner_company_id: number | null;
    is_active: boolean;
  } | null;
  alreadyLinked: boolean;
}): { ok: true } | { ok: false; reason: ConnectRejectReason } {
  if (
    input.clientCompanyId == null ||
    !Number.isFinite(input.clientCompanyId) ||
    input.clientCompanyId <= 0
  ) {
    return { ok: false, reason: 'forbidden_no_company' };
  }
  if (input.companyType === 'furnizor') {
    return { ok: false, reason: 'forbidden_furnizor' };
  }
  // Platform-wide roles (e.g. "admin") may still connect when JWT carries an
  // explicit client company context — association is company-scoped, not role-scoped.
  if (!input.normalizedCode) {
    return { ok: false, reason: 'invalid_code' };
  }
  if (
    !input.supplier ||
    input.supplier.owner_company_id == null ||
    Number(input.supplier.owner_company_id) <= 0
  ) {
    return { ok: false, reason: 'invalid_code' };
  }
  if (input.supplier.is_active === false) {
    return { ok: false, reason: 'invalid_code' };
  }
  if (Number(input.supplier.owner_company_id) === input.clientCompanyId) {
    return { ok: false, reason: 'self_link' };
  }
  if (input.alreadyLinked) {
    return { ok: false, reason: 'already_linked' };
  }
  return { ok: true };
}

/** True when supplier row is an account Cont (has furnizor tenant owner). */
export function isAccountOwnedSupplier(
  ownerCompanyId: number | null | undefined,
): boolean {
  const n = Number(ownerCompanyId);
  return Number.isFinite(n) && n > 0;
}

/**
 * Client/furnizor tenant access (non-platform):
 * - Explicit `client_supplier_links` always grants access
 * - Cont (`owner_company_id` set): own owner company OR link — never location-only
 * - Manual (`owner_company_id` null): location ∩ company locations
 */
export function isSupplierAccessibleViaLocationOrLink(input: {
  hasPlatformWideAccess: boolean;
  linkedByCompany: boolean;
  supplierLocationIds: number[];
  /** Locations belonging to the requester's company (ownership scope for Manual). */
  employeeLocationIds: number[];
  ownerCompanyId?: number | null;
  requesterCompanyId?: number | null;
}): boolean {
  if (input.hasPlatformWideAccess) return true;
  if (input.linkedByCompany) return true;

  const requesterCompanyId = Number(input.requesterCompanyId);
  const hasRequesterCompany =
    Number.isFinite(requesterCompanyId) && requesterCompanyId > 0;
  if (
    hasRequesterCompany &&
    isAccountOwnedSupplier(input.ownerCompanyId) &&
    Number(input.ownerCompanyId) === requesterCompanyId
  ) {
    return true;
  }

  if (isAccountOwnedSupplier(input.ownerCompanyId)) {
    return false;
  }

  // Manual: company location intersection only
  if (input.supplierLocationIds.length === 0) return false;
  if (input.employeeLocationIds.length === 0) return false;
  return input.supplierLocationIds.some((id) =>
    input.employeeLocationIds.includes(id),
  );
}

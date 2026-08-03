import { ForbiddenException } from '@nestjs/common';

const POSITION_MAGAZIONER = 5;
const POSITION_SOFER = 4;

function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
}

export type CalendarJwtUser = {
  userId?: number;
  sub?: number;
  username?: string;
  permissions?: string[];
  roles?: string[];
  position_default_id?: number | null;
  employee_id?: number;
  id_employee?: number;
  company_type?: string | null;
  company_id?: number | null;
  work_location_id?: number | null;
  work_location_default_id?: number | null;
};

export function assertJwtEmployeeIdConsistency(user?: CalendarJwtUser): void {
  const sub = Number(user?.sub ?? user?.userId);
  if (!Number.isFinite(sub) || sub <= 0) return;
  const raw = user?.id_employee ?? user?.employee_id;
  if (raw == null || String(raw).trim() === '') return;
  const idEmployee = Number(raw);
  if (
    Number.isFinite(idEmployee) &&
    idEmployee > 0 &&
    idEmployee !== sub
  ) {
    throw new ForbiddenException(
      'Configurare autentificare invalidă: JWT.sub și id_employee diferă',
    );
  }
}

export function getCanonicalEmployeeId(user?: CalendarJwtUser): number | null {
  assertJwtEmployeeIdConsistency(user);
  const sub = Number(user?.sub ?? user?.userId);
  if (Number.isFinite(sub) && sub > 0) return sub;
  return null;
}

export function getJwtWorkLocationId(user?: CalendarJwtUser): number | null {
  const loc = Number(user?.work_location_id ?? user?.work_location_default_id);
  return Number.isFinite(loc) && loc > 0 ? loc : null;
}

export function getJwtCompanyId(user?: CalendarJwtUser): number | null {
  const companyId = Number(user?.company_id);
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

export function isSupplierManagementAccount(
  permissions: string[],
  roles: string[],
  companyType?: string | null,
): boolean {
  if (roles.includes('magazioner') || roles.includes('sofer')) return false;
  const type = typeof companyType === 'string' ? companyType.toLowerCase().trim() : '';
  if (type === 'client') return false;
  const isFurnizorTenant = type === 'furnizor' || roles.includes('furnizor');
  if (!isFurnizorTenant) return false;
  return permissions.includes('suppliers.create') || roles.includes('furnizor');
}

export function isOperationalStaffUser(user?: CalendarJwtUser): boolean {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (
    permissions.includes('assignment.read_all') ||
    permissions.includes('assignment.read_company')
  ) {
    return false;
  }
  const roles = normalizeRoles(user?.roles);
  const positionId = Number(user?.position_default_id);
  const hasPosition =
    positionId === POSITION_MAGAZIONER || positionId === POSITION_SOFER;
  if (isSupplierManagementAccount(permissions, roles, user?.company_type)) {
    return false;
  }
  return (
    roles.includes('magazioner') ||
    roles.includes('sofer') ||
    hasPosition
  );
}

export function isCalendarAdminUser(user?: CalendarJwtUser): boolean {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return (
    permissions.includes('calendar.read') ||
    permissions.includes('calendar.read_all') ||
    permissions.includes('assignment.read_all') ||
    permissions.includes('assignment.read_company')
  );
}

export function isFurnizorSupplierAdmin(user?: CalendarJwtUser): boolean {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const roles = normalizeRoles(user?.roles);
  return isSupplierManagementAccount(permissions, roles, user?.company_type);
}

export function assertNoArbitraryCompanyFilter(
  filters: Record<string, unknown>,
): void {
  if (filters.company_id != null && String(filters.company_id).trim() !== '') {
    throw new ForbiddenException(
      'Filtrarea după company_id din query nu este permisă',
    );
  }
}

export function assertOperationalLocationFilter(
  user: CalendarJwtUser,
  locationId?: number,
): void {
  const jwtLocationId = getJwtWorkLocationId(user);
  if (jwtLocationId == null) {
    throw new ForbiddenException(
      'Locația de lucru nu este configurată în tokenul de autentificare',
    );
  }
  if (locationId == null) {
    return;
  }
  if (Number(locationId) !== jwtLocationId) {
    throw new ForbiddenException(
      'location_id nu corespunde locației din tokenul de autentificare',
    );
  }
}

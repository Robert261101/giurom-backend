import { ForbiddenException } from '@nestjs/common';

const POSITION_MAGAZIONER = 5;
const POSITION_SOFER = 4;

function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
}

export type EmployeeAccessUser = {
  sub?: number;
  roles?: string[];
  permissions?: string[];
  position_default_id?: number | null;
  employee_id?: number;
  id_employee?: number;
  company_type?: string | null;
  company_id?: number | null;
};

export function assertJwtEmployeeIdConsistency(user?: EmployeeAccessUser): void {
  const sub = Number(user?.sub);
  if (!Number.isFinite(sub) || sub <= 0) {
    return;
  }
  const raw = user?.id_employee ?? user?.employee_id;
  if (raw == null || String(raw).trim() === '') {
    return;
  }
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

export function getCanonicalEmployeeId(user?: EmployeeAccessUser): number | null {
  assertJwtEmployeeIdConsistency(user);
  const sub = Number(user?.sub);
  if (Number.isFinite(sub) && sub > 0) {
    return sub;
  }
  return null;
}

export function isSupplierManagementAccount(
  permissions: string[],
  roles: string[],
): boolean {
  return (
    permissions.includes('suppliers.create') &&
    !roles.includes('magazioner') &&
    !roles.includes('sofer')
  );
}

export function isOperationalStaffUser(user?: EmployeeAccessUser): boolean {
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

  if (isSupplierManagementAccount(permissions, roles)) {
    return false;
  }

  return (
    roles.includes('magazioner') ||
    roles.includes('sofer') ||
    hasPosition
  );
}

export function isAdminUser(user?: EmployeeAccessUser): boolean {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return (
    permissions.includes('assignment.read_all') ||
    permissions.includes('assignment.read_company')
  );
}

export function isFurnizorSupplierAdmin(user?: EmployeeAccessUser): boolean {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const roles = normalizeRoles(user?.roles);
  return isSupplierManagementAccount(permissions, roles);
}

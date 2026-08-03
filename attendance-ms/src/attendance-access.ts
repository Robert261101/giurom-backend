import { ForbiddenException } from '@nestjs/common';

export interface AttendanceUserContext {
  employeeId: number | null;
  permissions: string[];
  companyId: number | null;
  companyType: string | null;
}

const POSITION_MAGAZIONER = 5;
const POSITION_SOFER = 4;

function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
}

/** Verifică consistența JWT.sub cu id_employee / employee_id din payload. */
export function assertJwtEmployeeIdConsistency(user?: {
  sub?: number;
  employee_id?: number;
  id_employee?: number;
}): void {
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

/** Identitatea angajatului — exclusiv JWT.sub (după verificarea consistenței claim-urilor). */
export function getCanonicalEmployeeId(user?: {
  sub?: number;
  employee_id?: number;
  id_employee?: number;
}): number | null {
  assertJwtEmployeeIdConsistency(user);
  const sub = Number(user?.sub);
  if (Number.isFinite(sub) && sub > 0) {
    return sub;
  }
  return null;
}

export function buildAttendanceUserContext(user?: {
  userId?: number;
  sub?: number;
  employee_id?: number;
  id_employee?: number;
  permissions?: string[];
  company_id?: number | null;
  company_type?: string | null;
}): AttendanceUserContext {
  const employeeId = getCanonicalEmployeeId(user);
  const companyIdRaw = user?.company_id;
  return {
    employeeId,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    companyId:
      companyIdRaw != null && Number.isFinite(Number(companyIdRaw))
        ? Number(companyIdRaw)
        : null,
    companyType:
      typeof user?.company_type === 'string' ? user.company_type : null,
  };
}

/** employee_id exclusiv din JWT.sub pentru acțiuni personale (my-punch, my-timesheet). */
export function getSelfServiceEmployeeId(user?: {
  sub?: number;
  employee_id?: number;
  id_employee?: number;
}): number {
  assertJwtEmployeeIdConsistency(user);
  const employeeId = Number(user?.sub);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
  }
  return employeeId;
}

/**
 * Filtru employee_id pentru GET /shifts — operaționalii văd doar propriile ture (JWT.sub).
 */
export function resolveShiftsEmployeeFilter(
  user?: {
    sub?: number;
    roles?: string[];
    permissions?: string[];
    position_default_id?: number | null;
    employee_id?: number;
    id_employee?: number;
    company_id?: number | null;
    company_type?: string | null;
  },
  requestedEmployeeId?: number,
): number | undefined {
  if (isOperationalStaffUser(user)) {
    return getSelfServiceEmployeeId(user);
  }

  const ctx = buildAttendanceUserContext(user);
  if (
    ctx.employeeId != null &&
    !isAdminOrSuperAdmin(ctx) &&
    !isFurnizorTenant(ctx) &&
    !hasAttendanceManagePermission(ctx.permissions)
  ) {
    return ctx.employeeId;
  }

  return requestedEmployeeId;
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

/** Magazioner sau șofer operațional (nu cont furnizor admin, nu admin). */
export function isOperationalStaffUser(user?: {
  sub?: number;
  roles?: string[];
  permissions?: string[];
  position_default_id?: number | null;
  company_type?: string | null;
}): boolean {
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

export function assertOperationalSelfService(user?: {
  sub?: number;
  roles?: string[];
  permissions?: string[];
  position_default_id?: number | null;
}): number {
  const employeeId = getSelfServiceEmployeeId(user);
  if (!isOperationalStaffUser(user)) {
    throw new ForbiddenException(
      'Doar angajații operaționali (magazioner/șofer) își pot gestiona propriul pontaj',
    );
  }
  return employeeId;
}

export function hasAttendanceManagePermission(permissions: string[]): boolean {
  return permissions.includes('attendance.update');
}

export function isAdminOrSuperAdmin(ctx: AttendanceUserContext): boolean {
  return (
    ctx.permissions.includes('assignment.read_all') ||
    ctx.permissions.includes('assignment.read_company')
  );
}

export function isFurnizorTenant(ctx: AttendanceUserContext): boolean {
  return ctx.companyType === 'furnizor' && ctx.companyId != null && ctx.companyId > 0;
}

export function isOperationalEmployee(ctx: AttendanceUserContext): boolean {
  if (isAdminOrSuperAdmin(ctx) || isFurnizorTenant(ctx)) {
    return false;
  }
  return ctx.employeeId != null;
}

/** Admin/superadmin cu attendance.update sau furnizor tenant (staff verificat în service). */
export function canCorrectAttendance(ctx: AttendanceUserContext): boolean {
  if (isAdminOrSuperAdmin(ctx) && hasAttendanceManagePermission(ctx.permissions)) {
    return true;
  }
  if (isFurnizorTenant(ctx)) {
    return true;
  }
  return false;
}

export function assertEmployeeSelfOrManager(
  ctx: AttendanceUserContext,
  targetEmployeeId: number,
  allowedEmployeeIds?: number[],
): void {
  if (ctx.employeeId != null && ctx.employeeId === targetEmployeeId) {
    return;
  }
  // Scope explicit (colegi operaționali, staff furnizor, etc.)
  if (allowedEmployeeIds?.includes(targetEmployeeId)) {
    return;
  }
  if (
    isAdminOrSuperAdmin(ctx) &&
    hasAttendanceManagePermission(ctx.permissions)
  ) {
    return;
  }
  throw new ForbiddenException('Nu aveți acces la pontajul acestui angajat');
}

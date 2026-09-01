import { ForbiddenException } from '@nestjs/common';
import {
  isPlatformOrderRequester,
  OrderRequesterUser,
  resolveOrderActorUserId,
} from './order-access';

/**
 * Client admin / HR — may manage operational employees within tenant.
 * Bound assignment.read_all still requires async company check on target employee.
 */
export function canManageCompanyOperationalEmployees(
  user?: OrderRequesterUser | null,
): boolean {
  if (!user) {
    return false;
  }
  if (isPlatformOrderRequester(user)) {
    return true;
  }
  const perms = user.permissions ?? [];
  return (
    user.isAdmin === true ||
    user.isSuperAdmin === true ||
    perms.includes('employees.read') ||
    perms.includes('assignment.read_company') ||
    perms.includes('assignment.read_all')
  );
}

/**
 * Dashboard lists (storekeeper/driver): self, platform, or tenant admin after company check.
 */
export function assertOperationalEmployeeDashboardAccess(
  user: OrderRequesterUser | undefined,
  targetEmployeeId: number,
): void {
  if (!user) {
    return;
  }
  if (isPlatformOrderRequester(user)) {
    return;
  }

  const actorId = resolveOrderActorUserId(user);
  if (actorId != null && Number(actorId) === Number(targetEmployeeId)) {
    return;
  }

  if (!canManageCompanyOperationalEmployees(user)) {
    throw new ForbiddenException(
      'Nu aveți permisiunea de a accesa comenzile acestui angajat',
    );
  }
}

/**
 * Driver mutation (complete): self-only unless platform/admin manager.
 */
export function assertDriverSelfOrOperationalAdmin(
  user: OrderRequesterUser | undefined,
  driverId: number,
): void {
  if (!user) {
    return;
  }
  if (isPlatformOrderRequester(user)) {
    return;
  }
  if (canManageCompanyOperationalEmployees(user)) {
    return;
  }

  const actorId = resolveOrderActorUserId(user);
  if (actorId == null || Number(actorId) !== Number(driverId)) {
    throw new ForbiddenException(
      'Doar șoferul atribuit poate efectua această acțiune',
    );
  }
}

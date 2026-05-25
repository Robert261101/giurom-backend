import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    if (request.bypassAuth) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const user = request?.user;
    if (!user?.permissions) {
      this.logger.warn('User has no permissions');
      throw new ForbiddenException('Fără permisiuni');
    }

    const effective = this.effectivePermissions(user);

    // Cel puțin una dintre permisiunile listate (OR), ca în veziv-tasks
    const hasAny = requiredPermissions.some((perm) => effective.has(perm));

    if (hasAny) return true;

    // Dacă nu are niciuna, verifică dacă încearcă să vadă propriile date
    // Poate fi /employees/:id sau /employees/:employeeId/... (pentru locații, etc.)
    const requestId = request.params?.id || request.params?.employeeId;
    const userEmployeeId = user.id || user.userId; // id_employee din JWT

    if (requestId && userEmployeeId && String(requestId) === String(userEmployeeId)) return true;

    this.logger.warn(`User missing required permissions (need one of): ${requiredPermissions.join(', ')}`);
    throw new ForbiddenException('Permisiuni insuficiente');
  }

  /**
   * Tenant furnizor cu `suppliers.create` gestionează angajații fără permisiuni employees.* pe rol.
   */
  private effectivePermissions(user: {
    permissions?: string[];
    company_type?: string | null;
  }): Set<string> {
    const perms = new Set<string>((user.permissions as string[]) || []);
    if (
      user.company_type === 'furnizor' &&
      perms.has('suppliers.create')
    ) {
      [
        'employees.read',
        'employees.read_own',
        'employees.create',
        'employees.update',
        'employees.delete',
      ].forEach((p) => perms.add(p));
    }
    return perms;
  }
}
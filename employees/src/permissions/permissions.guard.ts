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

    // Verifică dacă utilizatorul are permisiunea necesară
    const hasAll = requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    
    // Dacă nu are permisiunea, verifică dacă încearcă să vadă propriile date
    if (!hasAll) {
      // Verifică dacă este un request pentru propriile date
      // Poate fi /employees/:id sau /employees/:employeeId/... (pentru locații, etc.)
      const requestId = request.params?.id || request.params?.employeeId;
      const userEmployeeId = user.id || user.userId; // id_employee din JWT
      
      if (requestId && userEmployeeId && String(requestId) === String(userEmployeeId)) return true;
      
      this.logger.warn(`User missing required permissions: ${requiredPermissions.join(', ')}`);
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    return true;
  }
}
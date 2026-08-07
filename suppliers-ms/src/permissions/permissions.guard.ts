import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PERMISSIONS_ANY_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.bypassAuth === true) {
      return true;
    }

    const permissionsAny = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_ANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permissionsAny?.length) {
      const user = request?.user;
      this.logger.log(`[PermissionsGuard] Checking ANY permissions: ${JSON.stringify(permissionsAny)}`);
      this.logger.log(`[PermissionsGuard] User permissions: ${JSON.stringify(user?.permissions || [])}`);

      if (!user?.permissions) {
        this.logger.error('[PermissionsGuard] No user permissions found');
        throw new ForbiddenException('Fără permisiuni');
      }
      const hasAny = permissionsAny.some((perm) => (user.permissions as string[]).includes(perm));
      this.logger.log(`[PermissionsGuard] Has ANY required permission: ${hasAny}`);
      if (!hasAny) {
        this.logger.error(`[PermissionsGuard] Missing ANY of required permissions: ${JSON.stringify(permissionsAny)}`);
        throw new ForbiddenException('Permisiuni insuficiente');
      }
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.log('[PermissionsGuard] No permissions required');
      return true;
    }

    this.logger.log(`[PermissionsGuard] Checking ALL permissions: ${JSON.stringify(requiredPermissions)}`);
    this.logger.log(`[PermissionsGuard] User permissions: ${JSON.stringify(request?.user?.permissions || [])}`);

    const user = request?.user;
    if (!user?.permissions) {
      this.logger.error('[PermissionsGuard] No user permissions found');
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAll = requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    this.logger.log(`[PermissionsGuard] Has ALL required permissions: ${hasAll}`);
    if (!hasAll) {
      this.logger.error(`[PermissionsGuard] Missing required permissions: ${JSON.stringify(requiredPermissions)}`);
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    return true;
  }
}
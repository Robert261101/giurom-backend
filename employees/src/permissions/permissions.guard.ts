import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request.bypassAuth) {
      this.logger.log('Bypassing permissions check for internal service request');
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.log('No permissions required for this endpoint');
      return true;
    }

    const user = request?.user;
    if (!user?.permissions) {
      this.logger.warn('User has no permissions');
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAll = requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    if (!hasAll) {
      this.logger.warn(`User missing required permissions: ${requiredPermissions.join(', ')}`);
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    
    this.logger.log(`User has all required permissions: ${requiredPermissions.join(', ')}`);
    return true;
  }
}
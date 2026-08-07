import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    this.logger.log(`Required permissions: ${JSON.stringify(requiredPermissions)}`);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.log('No permissions required, allowing access');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    this.logger.log(`User: ${JSON.stringify(user)}`);
    
    if (!user?.permissions) {
      this.logger.error('User has no permissions');
      throw new ForbiddenException('Fără permisiuni');
    }

    this.logger.log(`User permissions: ${JSON.stringify(user.permissions)}`);

    const hasAll = requiredPermissions.some((perm) =>
      (user.permissions as string[]).includes(perm),
    );
    this.logger.log(`Has any required permission: ${hasAll}`);
    
    if (!hasAll) {
      this.logger.error(`User missing permissions. Required: ${JSON.stringify(requiredPermissions)}, User has: ${JSON.stringify(user.permissions)}`);
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    
    this.logger.log('User has all required permissions, allowing access');
    return true;
  }
}
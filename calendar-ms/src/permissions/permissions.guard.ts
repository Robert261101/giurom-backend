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

    this.logger.log(`Required permissions: ${requiredPermissions ? requiredPermissions.join(', ') : 'none'}`);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.log('No required permissions, allowing access');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    
    this.logger.log(`User: ${JSON.stringify(user)}`);

    if (!user?.permissions) {
      this.logger.warn('User has no permissions');
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAll = requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    this.logger.log(`User has required permissions: ${hasAll}`);

    if (!hasAll) {
      this.logger.warn(`User missing permissions: ${requiredPermissions.filter(perm => !(user.permissions as string[]).includes(perm)).join(', ')}`);
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    
    this.logger.log('Access granted');
    return true;
  }
}
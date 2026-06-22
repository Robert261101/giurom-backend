import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request.bypassAuth) {
      return true;
    }
    
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const user = request?.user;
    if (!user?.permissions) {
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAny = requiredPermissions.some((perm) =>
      (user.permissions as string[]).includes(perm),
    );
    if (!hasAny) {
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    return true;
  }
}



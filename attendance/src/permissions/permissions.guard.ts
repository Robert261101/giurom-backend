import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Check for internal service headers first
    const internalService = request.headers['x-internal-service'];
    const serviceSecret = request.headers['x-service-secret'];
    
    if (internalService && serviceSecret) {
      // Validate internal service secret
      const expectedSecret = process.env.SERVICE_SECRET || 'default-service-secret';
      
      if (serviceSecret === expectedSecret) {
        // Mark request as internal service request and bypass permissions
        request.internalService = internalService;
        request.bypassAuth = true;
        return true;
      } else {
        throw new UnauthorizedException('Invalid service secret');
      }
    }

    const user = request?.user;
    if (!user?.permissions) {
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAll = requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    if (!hasAll) {
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    return true;
  }
}



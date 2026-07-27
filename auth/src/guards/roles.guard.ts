import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Dacă nu sunt specificate roluri sau permisiuni, permite accesul
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (request.bypassAuth) {
      return true;
    }

    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Utilizatorul nu este autentificat');
    }

    // Verifică rolurile
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some(role => 
        user.roles && user.roles.includes(role)
      );
      
      if (!hasRole) {
        throw new ForbiddenException(
          `Acces interzis. Roluri necesare: ${requiredRoles.join(', ')}`
        );
      }
    }

    // Verifică permisiunile
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some(permission => 
        user.permissions && user.permissions.includes(permission)
      );
      
      if (!hasPermission) {
        throw new ForbiddenException(
          `Acces interzis. Permisiuni necesare: ${requiredPermissions.join(', ')}`
        );
      }
    }

    return true;
  }
} 
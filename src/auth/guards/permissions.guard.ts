import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obține permisiunile necesare pentru această rută
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Dacă nu sunt specificate permisiuni, permite accesul
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Obține utilizatorul din request (setat de JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException('Nu ai permisiunile necesare pentru această acțiune');
    }

    // Verifică dacă utilizatorul are cel puțin una din permisiunile necesare
    const hasPermission = requiredPermissions.some(permission => 
      user.permissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Nu ai permisiunile necesare. Permisiuni necesare: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
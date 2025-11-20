import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);
  
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    // Verificăm și după un mic delay pentru a ne asigura că InternalServiceGuard a setat bypassAuth
    if (request.bypassAuth) {
      this.logger.log(`✅ Bypassing permissions check - bypassAuth is set to: ${request.bypassAuth}`);
      return true;
    }
    
    this.logger.log(`🔍 [PermissionsGuard] bypassAuth: ${request.bypassAuth}, path: ${request.path || request.url}, headers: ${JSON.stringify(Object.keys(request.headers || {}).filter(k => k.toLowerCase().startsWith('x-')))}`);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
        
    // If this is an internal service request, bypass permissions check
    if (request.bypassAuth === true) {
      return true;
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
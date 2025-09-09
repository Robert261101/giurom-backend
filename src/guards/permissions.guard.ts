
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../permissions/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    console.log('🔍 [PermissionsGuard] Verificare permisiuni pentru:', request.url)
    
    // Citim metadatele definite prin @Permissions
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    
    console.log('🔍 [PermissionsGuard] Permisiuni cerute:', requiredPermissions)

    // Dacă nu există permisiuni definite pe ruta asta → o permitem implicit
    if (!requiredPermissions) {
      console.log('✅ [PermissionsGuard] Nu sunt permisiuni definite - permit accesul')
      return true;
    }

    // Luăm userul din request (pus de JwtAuthGuard)
    const user = request.user;
    console.log('🔍 [PermissionsGuard] User din request:', user ? 'EXISTĂ' : 'LIPSEȘTE')
    if (user) {
      console.log('🔍 [PermissionsGuard] User permissions:', user.permissions)
    }

    // Dacă userul nu are permisiuni în payload → blocăm accesul
    if (!user?.permissions) {
      console.log('❌ [PermissionsGuard] User nu are permisiuni - bloc accesul')
      return false;
    }

    // Verificăm dacă userul are cel puțin o permisiune cerută
    const hasPermission = requiredPermissions.some((perm) =>
      user.permissions.includes(perm),
    );
    
    console.log('🔍 [PermissionsGuard] User are permisiunea cerută:', hasPermission)
    return hasPermission;
  }
}


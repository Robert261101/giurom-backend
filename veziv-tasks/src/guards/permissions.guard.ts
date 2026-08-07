
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../permissions/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Citim metadatele definite prin @Permissions
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Dacă nu există permisiuni definite pe ruta asta → o permitem implicit
    if (!requiredPermissions) {
      return true;
    }

    // Luăm userul din request (pus de JwtAuthGuard)
    const user = request.user;

    // Dacă userul nu are permisiuni în payload → blocăm accesul cu mesaj personalizat
    if (!user?.permissions) {
      this.logger.log('❌ [PermissionsGuard] User nu are permisiuni - bloc accesul');
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Nu aveți permisiunile necesare pentru a accesa această resursă.',
        error: 'Forbidden',
        requiredPermissions: requiredPermissions,
        userPermissions: []
      });
    }

    // Verificăm dacă userul are cel puțin o permisiune cerută
    const hasPermission = requiredPermissions.some((perm) =>
      user.permissions.includes(perm),
    );
    
    // Dacă nu are permisiunea → aruncăm eroare personalizată
    if (!hasPermission) {
      const actionMap: { [key: string]: string } = {
        'template.create': 'crea șabloane',
        'template.read_all': 'vizualiza șabloanele',
        'template.update': 'modifica șabloane',
        'template.delete': 'șterge șabloane',
        'assignment.create': 'crea sarcini',
        'assignment.read_all': 'vizualiza toate sarcinile',
        'assignment.read_own': 'vizualiza sarcinile proprii',
        'assignment.update': 'modifica sarcini',
        'assignment.delete': 'șterge sarcini',
        'execution.create': 'executa sarcini',
        'execution.read_all': 'vizualiza toate execuțiile',
        'execution.read_own': 'vizualiza execuțiile proprii',
        'execution.update': 'modifica execuții',
        'execution.delete': 'șterge execuții',
      };

      const missingPermissions = requiredPermissions.filter(
        perm => !user.permissions.includes(perm)
      );
      
      const actionDescriptions = missingPermissions
        .map(perm => actionMap[perm] || perm)
        .join(', ');

        this.logger.log(`❌ [PermissionsGuard] User ${user.email} NU are permisiunile: ${missingPermissions.join(', ')}`);
      
      throw new ForbiddenException({
        statusCode: 403,
        message: `Nu aveți permisiunea de a ${actionDescriptions}.`,
        error: 'Forbidden',
        details: `Pentru a efectua această acțiune, aveți nevoie de una dintre următoarele permisiuni: ${missingPermissions.join(', ')}`,
        requiredPermissions: missingPermissions,
        userPermissions: user.permissions,
        userEmail: user.email,
        userName: `${user.first_name} ${user.last_name}`
      });
    }
    
    return hasPermission;
  }
}


import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PERMISSIONS_ANY_KEY, AUTH_ONLY_KEY } from './permissions.decorator';
import { AttendanceService } from '../attendance.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly attendanceService: AttendanceService
  ) {}

  /** Permisiuni permise pentru apeluri interne (x-internal-service + x-service-secret). Doar read. */
  private static readonly INTERNAL_ALLOWED_PERMISSIONS = ['attendance.read'];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authOnly = this.reflector.getAllAndOverride<boolean>(AUTH_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authOnly === true) {
      return true;
    }

    const permissionsAny = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permissionsAny?.length) {
      const request = context.switchToHttp().getRequest();
      const user = request?.user;
      if (!user?.permissions) {
        throw new ForbiddenException('Fără permisiuni');
      }
      const hasAny = permissionsAny.some((perm) =>
        (user.permissions as string[]).includes(perm),
      );
      if (!hasAny) {
        throw new ForbiddenException('Permisiuni insuficiente');
      }
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (request.internalService) {
      const allowed = PermissionsGuard.INTERNAL_ALLOWED_PERMISSIONS;
      const hasAllAllowed = requiredPermissions.every((p) => allowed.includes(p));
      if (!hasAllAllowed) {
        throw new ForbiddenException(
          'Apeluri interne: doar permisiunea attendance.read este permisă',
        );
      }
      return true;
    }

    const user = request?.user;
    if (!user?.permissions) {
      throw new ForbiddenException('Fără permisiuni');
    }

    const userPerms = (user.permissions as string[]) ?? [];
    const roles = Array.isArray(user.roles)
      ? user.roles.map((r: string) => String(r).toLowerCase())
      : [];
    const isFurnizorPontajManager =
      userPerms.includes('suppliers.create') &&
      (user.company_type === 'furnizor' || roles.includes('furnizor'));

    const hasAll = requiredPermissions.every((perm) => userPerms.includes(perm));
    
    // Dacă utilizatorul nu are permisiunea, verifică dacă încearcă să creeze o prezență pentru propriul shift
    if (!hasAll && requiredPermissions.includes('attendance.create')) {
      if (isFurnizorPontajManager) {
        return true;
      }
      const body = request.body;
      const shiftId = body?.shift_id;
      // În JWT, sub = id_employee (vezi auth.service.ts: sub: user.id_employee)
      // Verifică toate posibilitățile pentru ID-ul angajatului
      const userEmployeeId = user.id || user.userId || user.employee_id || user.sub;
      
      // Dacă există shift_id în body, verifică dacă shift-ul aparține angajatului
      if (shiftId && userEmployeeId) {
        try {
          const shift = await this.attendanceService.findShiftById(shiftId);
          // Compară ca numere pentru a evita problemele de tip (string vs number)
          const shiftEmployeeId = Number(shift?.employee_id);
          const userEmployeeIdNum = Number(userEmployeeId);
          
          if (shift && shiftEmployeeId === userEmployeeIdNum) {
            // Permite crearea prezenței pentru propriul shift
            return true;
          }
        } catch (error) {
          // Dacă shift-ul nu există sau apare o eroare, continuă cu verificarea normală
          console.error('Error checking shift ownership:', error);
        }
      }
    }
    
    // Dacă utilizatorul nu are permisiunea, verifică dacă încearcă să actualizeze o prezență pentru propriul shift
    if (!hasAll && requiredPermissions.includes('attendance.update')) {
      if (isFurnizorPontajManager) {
        return true;
      }
      const presenceId = request.params?.id;
      // În JWT, sub = id_employee (vezi auth.service.ts: sub: user.id_employee)
      // Verifică toate posibilitățile pentru ID-ul angajatului
      const userEmployeeId = user.id || user.userId || user.employee_id || user.id_employee || user.sub;
      
      console.log('[PermissionsGuard] Checking presence ownership:', {
        presenceId,
        userEmployeeId,
        userKeys: Object.keys(user || {}),
        user: user
      });
      
      // Dacă există presence_id în params, verifică dacă prezența aparține angajatului prin shift
      if (presenceId && userEmployeeId) {
        try {
          const presence = await this.attendanceService.findPresenceById(Number(presenceId));
          console.log('[PermissionsGuard] Found presence:', {
            presenceId: presence?.id,
            shiftId: presence?.shift_id
          });
          
          if (presence?.shift_id) {
            const shift = await this.attendanceService.findShiftById(presence.shift_id);
            // Compară ca numere pentru a evita problemele de tip (string vs number)
            const shiftEmployeeId = Number(shift?.employee_id);
            const userEmployeeIdNum = Number(userEmployeeId);
            
            console.log('[PermissionsGuard] Comparing:', {
              shiftEmployeeId,
              userEmployeeIdNum,
              match: shiftEmployeeId === userEmployeeIdNum
            });
            
            if (shift && shiftEmployeeId === userEmployeeIdNum) {
              // Permite actualizarea prezenței pentru propriul shift
              console.log('[PermissionsGuard] Allowing update - presence belongs to employee');
              return true;
            }
          }
        } catch (error) {
          // Dacă prezența sau shift-ul nu există sau apare o eroare, continuă cu verificarea normală
          console.error('[PermissionsGuard] Error checking presence ownership:', error);
        }
      } else {
        console.log('[PermissionsGuard] Missing presenceId or userEmployeeId:', {
          presenceId,
          userEmployeeId
        });
      }
    }
    
    if (!hasAll) {
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    return true;
  }
}



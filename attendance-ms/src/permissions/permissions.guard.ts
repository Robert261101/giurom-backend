import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { AttendanceService } from '../attendance.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly attendanceService: AttendanceService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    if (!user?.permissions) {
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAll = requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    
    // Dacă utilizatorul nu are permisiunea, verifică dacă încearcă să creeze o prezență pentru propriul shift
    if (!hasAll && requiredPermissions.includes('attendance.create')) {
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
    
    if (!hasAll) {
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    return true;
  }
}



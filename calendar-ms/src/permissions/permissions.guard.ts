import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_ONLY_KEY,
  PERMISSIONS_ANY_KEY,
  PERMISSIONS_KEY,
} from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user?.permissions) {
      this.logger.warn('User has no permissions');
      throw new ForbiddenException('Fără permisiuni');
    }

    const hasAll = requiredPermissions.every((perm) =>
      (user.permissions as string[]).includes(perm),
    );

    if (!hasAll) {
      this.logger.warn(
        `User missing permissions: ${requiredPermissions
          .filter((perm) => !(user.permissions as string[]).includes(perm))
          .join(', ')}`,
      );
      throw new ForbiddenException('Permisiuni insuficiente');
    }

    return true;
  }
}

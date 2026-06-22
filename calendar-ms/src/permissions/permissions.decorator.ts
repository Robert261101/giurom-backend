import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ANY_KEY = 'permissions_any';
/** Doar JwtAuthGuard — fără verificare de permisiuni pe handler. */
export const AUTH_ONLY_KEY = 'auth_only';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PermissionsAny = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);

export const AuthOnly = () => SetMetadata(AUTH_ONLY_KEY, true);

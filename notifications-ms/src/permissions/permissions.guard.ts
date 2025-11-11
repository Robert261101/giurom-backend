import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if this is an RPC context (microservice message)
    if (context.getType() === 'rpc') {
      // For RPC contexts, check if bypassAuth is set by InternalServiceGuard
      const rpcContext = context.switchToRpc();
      const data = rpcContext.getData();
      
      // If bypassAuth is set, allow the request
      if (data?.bypassAuth || data?.headers?.bypassAuth) {
        return true;
      }
      
      // For RPC contexts, we don't have user permissions in the same way as HTTP
      // We'll allow the request to proceed since RPC messages are typically internal service communications
      return true;
    }
    
    // Handle HTTP context (existing logic)
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request?.bypassAuth) {
      return true;
    }
    
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
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
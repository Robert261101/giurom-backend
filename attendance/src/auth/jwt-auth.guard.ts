import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Check for internal service headers first
    const internalService = request.headers['x-internal-service'];
    const serviceSecret = request.headers['x-service-secret'];
    
    if (internalService && serviceSecret) {
      // Validate internal service secret
      const expectedSecret = process.env.SERVICE_SECRET || 'default-service-secret';
      
      if (serviceSecret === expectedSecret) {
        // Mark request as internal service request and bypass JWT auth
        request.internalService = internalService;
        request.bypassAuth = true;
        return true;
      } else {
        return false; // Invalid service secret
      }
    }
    
    // If no internal service headers, proceed with normal JWT authentication
    return super.canActivate(context);
  }
}



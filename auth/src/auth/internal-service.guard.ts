import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check for internal service headers
    const internalService = request.headers['x-internal-service'];
    const serviceSecret = request.headers['x-service-secret'];
    
    // If internal service headers are present, validate them
    if (internalService && serviceSecret) {
      // In production, you should validate the service secret against a secure store
      // For now, we'll use environment variables
      const expectedSecret = process.env.SERVICE_SECRET;
      if (!expectedSecret) {
        throw new UnauthorizedException('SERVICE_SECRET nu este configurat în variabilele de mediu');
      }
      
      if (serviceSecret === expectedSecret) {
        // Mark request as internal service request
        request.internalService = internalService;
        return true;
      } else {
        throw new UnauthorizedException('Invalid service secret');
      }
    }
    
    // If no internal service headers, allow the regular JWT guard to handle it
    return false;
  }
}
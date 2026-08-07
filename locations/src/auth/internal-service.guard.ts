import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name);

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
        // Bypass all other guards by adding a special flag
        request.bypassAuth = true;
        this.logger.log(`Internal service request allowed for service: ${internalService}`);
        return true;
      } else {
        this.logger.warn(`Invalid service secret provided for service: ${internalService}`);
        throw new UnauthorizedException('Invalid service secret');
      }
    }
    
    // If no internal service headers, do not interfere with other guards
    // Return true to allow other guards to handle the request
    this.logger.log('No internal service headers found, allowing other guards to handle request');
    return true;
  }
}
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RpcArgumentsHost } from '@nestjs/common/interfaces';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if this is an RPC context (microservice message)
    if (context.getType() === 'rpc') {
      // For RPC contexts, we need to check the data payload for internal service headers
      const rpcContext: RpcArgumentsHost = context.switchToRpc();
      const data = rpcContext.getData();
      
      // Check for internal service headers in the data payload
      const internalService = data?.headers?.['x-internal-service'] || data?.['x-internal-service'];
      const serviceSecret = data?.headers?.['x-service-secret'] || data?.['x-service-secret'];
      
      this.logger.log(`Internal service headers (RPC) - Service: ${internalService}, Secret present: ${!!serviceSecret}`);
      
      // If internal service headers are present, validate them
      if (internalService && serviceSecret) {
        const expectedSecret = process.env.SERVICE_SECRET;
        if (!expectedSecret) {
          throw new UnauthorizedException('SERVICE_SECRET nu este configurat în variabilele de mediu');
        }

        if (serviceSecret === expectedSecret) {
          // For RPC, we can't modify the request object, but we can allow the request
          this.logger.log(`Internal service request allowed for service: ${internalService} (RPC)`);
          return true;
        } else {
          this.logger.warn(`Invalid service secret provided for service: ${internalService} (RPC)`);
          throw new UnauthorizedException('Invalid service secret');
        }
      }
      
      // If no internal service headers, allow the request for RPC contexts
      this.logger.log('No internal service headers found, allowing RPC request');
      return true;
    }
    
    // Handle HTTP context (existing logic)
    const request = context.switchToHttp().getRequest();
    
    // Check if headers exist (defensive programming)
    if (!request || !request.headers) {
      this.logger.log('No request or headers found, allowing HTTP request');
      return true;
    }
    
    // Check for internal service headers
    const internalService = request.headers['x-internal-service'];
    const serviceSecret = request.headers['x-service-secret'];
    
    this.logger.log(`Internal service headers (HTTP) - Service: ${internalService}, Secret present: ${!!serviceSecret}`);
    
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
        this.logger.log(`Internal service request allowed for service: ${internalService} (HTTP)`);
        return true;
      } else {
        this.logger.warn(`Invalid service secret provided for service: ${internalService} (HTTP)`);
        throw new UnauthorizedException('Invalid service secret');
      }
    }
    
    // If no internal service headers, do not interfere with other guards
    // Return true to allow other guards to handle the request
    this.logger.log('No internal service headers found, allowing other guards to handle HTTP request');
    return true;
  }
}
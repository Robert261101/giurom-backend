import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { timingSafeEqual } from 'crypto';

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
      const expectedSecret = process.env.SERVICE_SECRET;
      if (!expectedSecret) {
        throw new UnauthorizedException('SERVICE_SECRET nu este configurat în variabilele de mediu');
      }
      if (secretsMatch(serviceSecret, expectedSecret)) {
        request.internalService = internalService;
        request.bypassAuth = true;
        this.logger.log(`Internal service request allowed for service: ${internalService}`);
        return true;
      }
      this.logger.warn(`Invalid service secret provided for service: ${internalService}`);
      throw new UnauthorizedException('Invalid service secret');
    }

    // No internal headers – let other guards (e.g. JWT) handle the request; no log to avoid noise
    return true;
  }
}
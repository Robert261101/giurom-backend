import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard JWT + bypass pentru apeluri interne (alte microservicii).
 * Când request-ul are header-ele x-internal-service și x-service-secret (valide),
 * autentificarea JWT este omisă și se setează request.user cu permisiuni limitate
 * (doar attendance.read), pentru acces securizat la GET /shifts etc.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const internalService = request.headers['x-internal-service'];
    const serviceSecret = request.headers['x-service-secret'];
    const expectedSecret =
      process.env.SERVICE_SECRET || 'default-service-secret';

    if (internalService && serviceSecret && serviceSecret === expectedSecret) {
      request.internalService = internalService;
      request.user = {
        sub: 'internal',
        permissions: ['attendance.read'],
      };
      return true;
    }

    return super.canActivate(context);
  }
}

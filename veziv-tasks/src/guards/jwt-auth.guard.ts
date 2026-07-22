import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Guard JWT + bypass pentru apeluri interne (alte microservicii, fără JWT de utilizator —
 * ex. job-ul de calcul bonusuri din `locations`). Când request-ul are header-ele
 * x-internal-service + x-service-secret (validate contra SERVICE_SECRET), autentificarea
 * JWT e omisă și se setează request.user cu permisiuni read-only limitate la execution.*.
 */
@Injectable()
export class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const internalService = request.headers['x-internal-service'];
    const serviceSecret = request.headers['x-service-secret'];
    const expectedSecret = process.env.SERVICE_SECRET;
    if (internalService && serviceSecret && expectedSecret && serviceSecret === expectedSecret) {
      request.user = {
        sub: 'internal',
        permissions: ['execution.read_all', 'execution.read_location', 'execution.read_company'],
      };
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      console.log('❌ [JwtAuthGuard] Token JWT lipsă')
      throw new UnauthorizedException('Token JWT lipsă');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch (error) {
      console.log('❌ [JwtAuthGuard] Token JWT invalid:', error.message)
      throw new UnauthorizedException('Token JWT invalid');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

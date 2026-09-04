import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Passport AuthGuard may surface Unauthorized as HTTP 500 when the Observable
 * rejection is not awaited. Await + explicit handleRequest keeps 401 stable.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.bypassAuth) {
      this.logger.log(
        '[JwtAuthGuard] Bypassing JWT authentication for internal service request',
      );
      return true;
    }

    if (this.isAllowedSyncKeyRequest(request)) {
      request.bypassAuth = true;
      this.logger.log(
        '[JwtAuthGuard] Bypassing JWT for giurom 2.0 sync-key integration route',
      );
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }

  /**
   * Rutele pe care giurom 2.0 le poate apela cu `X-Stock-Sync-Key`.
   *
   * Lista e explicita, nu `SERVICE_SECRET`-ul intern: cheia de sync deschide exact
   * citirea abonamentului unei firme, nu tot microserviciul de companii. giurom 2.0 e o
   * aplicatie SaaS multi-tenant, deci o compromitere acolo nu trebuie sa dea acces la
   * datele tuturor firmelor de aici.
   */
  private isAllowedSyncKeyRequest(request: any): boolean {
    const expected = (process.env.GIUROM2_STOCK_SYNC_API_KEY || '').trim();
    if (!expected) return false;

    const header = request?.headers?.['x-stock-sync-key'];
    const provided = typeof header === 'string' ? header.trim() : '';
    if (!provided || provided !== expected) return false;

    if (String(request?.method || '').toUpperCase() !== 'GET') return false;

    const path = String(request?.originalUrl || request?.url || '');
    return path.includes('/companies/integrations/partner-link/subscription');
  }

  handleRequest<TUser = any>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        info?.message || err?.message || 'Unauthorized',
      );
    }
    return user;
  }
}

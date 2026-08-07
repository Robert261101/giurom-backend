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

    if (request.bypassAuth) return true;

    // Căile pe care giurom 2.0 le poate apela cu X-Stock-Sync-Key (aceeași cheie ca la stoc).
    const syncKeyHeader = request.headers['x-stock-sync-key'];
    const syncKey =
      typeof syncKeyHeader === 'string' ? syncKeyHeader.trim() : '';
    const expected = (process.env.GIUROM2_STOCK_SYNC_API_KEY || '').trim();
    const path = String(request.originalUrl || request.url || '');
    const allowedSyncKeyPaths = ['/employees/sync/trigger-remote'];
    const method = String(request.method || '').toUpperCase();
    if (
      syncKey &&
      expected &&
      syncKey === expected &&
      method === 'POST' &&
      allowedSyncKeyPaths.some((allowed) => path.includes(allowed))
    ) {
      request.bypassAuth = true;
      this.logger.log(
        '[JwtAuthGuard] Bypassing JWT for employee sync key on trigger-remote',
      );
      return true;
    }

    return (await super.canActivate(context)) as boolean;
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

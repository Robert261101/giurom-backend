import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request.bypassAuth) {
      this.logger.log('[JwtAuthGuard] Bypassing JWT authentication for internal service request');
      return true;
    }

    // giurom 2.0 → POST /stock/sync/trigger-remote cu X-Stock-Sync-Key
    const syncKeyHeader = request.headers['x-stock-sync-key'];
    const syncKey =
      typeof syncKeyHeader === 'string' ? syncKeyHeader.trim() : '';
    const expected = (process.env.GIUROM2_STOCK_SYNC_API_KEY || '').trim();
    const path = String(request.originalUrl || request.url || '');
    if (
      syncKey &&
      expected &&
      syncKey === expected &&
      request.method === 'POST' &&
      path.includes('/stock/sync/trigger-remote')
    ) {
      request.bypassAuth = true;
      this.logger.log(
        '[JwtAuthGuard] Bypassing JWT for stock sync trigger-remote (API key)',
      );
      return true;
    }
    
    this.logger.log('[JwtAuthGuard] Proceeding with normal JWT authentication');
    // Otherwise, proceed with normal JWT authentication
    return super.canActivate(context);
  }
}



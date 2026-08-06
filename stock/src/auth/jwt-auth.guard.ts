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

    // Căile pe care giurom 2.0 le poate apela cu X-Stock-Sync-Key.
    //
    // Deliberat o listă explicită de căi, nu SERVICE_SECRET-ul intern: cheia de sync dă
    // acces exact la aceste operații, nu la tot microserviciul de stoc. giurom 2.0 e o
    // aplicație SaaS multi-tenant, deci o compromitere acolo nu trebuie să deschidă
    // întregul stoc de aici.
    const syncKeyHeader = request.headers['x-stock-sync-key'];
    const syncKey =
      typeof syncKeyHeader === 'string' ? syncKeyHeader.trim() : '';
    const expected = (process.env.GIUROM2_STOCK_SYNC_API_KEY || '').trim();
    const path = String(request.originalUrl || request.url || '');
    const allowedSyncKeyPaths = [
      '/stock/sync/trigger-remote',
      // Mișcările de stoc făcute în giurom 2.0, împinse înapoi aici ca sursa de adevăr
      // să rămână una singură. Vezi app2-movement.controller.ts.
      '/stock/integrations/app2-movement',
      // Aprobarea/respingerea cererilor de aruncare, decisă în giurom 2.0. Consumul de
      // stoc se execută tot aici. Vezi app2-waste.controller.ts.
      '/stock/integrations/app2-waste-decision',
      '/stock/integrations/app2-waste-refresh',
    ];
    if (
      syncKey &&
      expected &&
      syncKey === expected &&
      request.method === 'POST' &&
      allowedSyncKeyPaths.some((allowed) => path.includes(allowed))
    ) {
      request.bypassAuth = true;
      this.logger.log(`[JwtAuthGuard] Bypassing JWT for sync-key path ${path}`);
      return true;
    }
    
    this.logger.log('[JwtAuthGuard] Proceeding with normal JWT authentication');
    // Otherwise, proceed with normal JWT authentication
    return super.canActivate(context);
  }
}



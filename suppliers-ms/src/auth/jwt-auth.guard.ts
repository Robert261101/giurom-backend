import { Injectable, ExecutionContext, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    // Check if this is an RPC context (microservice message)
    if (context.getType() === "rpc") {
      // For RPC contexts, check if bypassAuth is set by InternalServiceGuard
      const rpcContext = context.switchToRpc();
      const data = rpcContext.getData();

      // If bypassAuth is set, allow the request
      if (data?.bypassAuth || data?.headers?.bypassAuth) {
        this.logger.log(
          "[JwtAuthGuard] Bypassing JWT authentication for internal service request (RPC)",
        );
        return true;
      }

      // For RPC contexts, we don't have HTTP headers, so we can't do JWT auth
      // In this case, we allow the request to proceed (the underlying passport strategy will handle it)
      this.logger.log(
        "[JwtAuthGuard] No JWT auth possible in RPC context, allowing request",
      );
      return true;
    }

    // Handle HTTP context (existing logic)
    const request = context.switchToHttp().getRequest();

    // Caile pe care giurom 2.0 le poate apela cu X-Stock-Sync-Key.
    //
    // Deliberat o lista explicita de cai, nu SERVICE_SECRET-ul intern: cheia de sync da
    // acces exact la plasarea comenzilor pregatite in App2 si la catalogul din care se
    // compun, nu la tot microserviciul de furnizori. Acelasi tipar ca in stock-ms.
    if (this.isAllowedApp2SyncKeyRequest(request)) {
      this.logger.log(
        `[JwtAuthGuard] Bypassing JWT for sync-key path ${String(request?.originalUrl || request?.url || "")}`,
      );
      request.bypassAuth = true;
      return true;
    }

    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request?.bypassAuth) {
      this.logger.log(
        "[JwtAuthGuard] Bypassing JWT authentication for internal service request (HTTP)",
      );
      return true;
    }

    this.logger.log(
      "[JwtAuthGuard] Proceeding with normal JWT authentication (HTTP)",
    );
    // Otherwise, proceed with normal JWT authentication
    return super.canActivate(context);
  }

  /**
   * Cererile App2 acceptate pe cheia de sync: plasarea unei comenzi pregatite in giurom 2.0
   * si citirea catalogului de furnizori/produse din care se compune.
   *
   * Verificarea e pe cale SI pe metoda, nu doar pe cheie: o cheie valida nu trebuie sa
   * deschida si restul controller-ului de furnizori.
   */
  private isAllowedApp2SyncKeyRequest(request: {
    headers?: Record<string, unknown>;
    originalUrl?: string;
    url?: string;
    method?: string;
  }): boolean {
    const syncKeyHeader = request?.headers?.["x-stock-sync-key"];
    const syncKey =
      typeof syncKeyHeader === "string" ? syncKeyHeader.trim() : "";
    const expected = (process.env.GIUROM2_STOCK_SYNC_API_KEY || "").trim();
    if (!syncKey || !expected || syncKey !== expected) return false;

    const path = String(request?.originalUrl || request?.url || "");
    const method = String(request?.method || "").toUpperCase();

    if (method === "POST" && path.includes("/suppliers/app2/orders")) return true;
    if (method === "GET" && path.includes("/suppliers/app2/catalog")) return true;
    return false;
  }
}

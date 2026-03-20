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
}

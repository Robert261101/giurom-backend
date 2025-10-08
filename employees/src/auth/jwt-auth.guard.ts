import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request.bypassAuth) {
      this.logger.log('Bypassing JWT authentication for internal service request');
      return true;
    }
    
    this.logger.log('Proceeding with normal JWT authentication');
    // Otherwise, proceed with normal JWT authentication
    return super.canActivate(context);
  }
}
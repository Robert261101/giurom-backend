import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Passport AuthGuard may surface Unauthorized as HTTP 500 when the Observable
 * rejection is not awaited. Await + explicit handleRequest keeps 401 stable.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.bypassAuth) return true;

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

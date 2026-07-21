import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceSecret = request.headers['x-service-secret'];
    const expectedSecret = process.env.SERVICE_SECRET;
    if (serviceSecret && expectedSecret && serviceSecret === expectedSecret) {
      return true;
    }
    throw new UnauthorizedException('Invalid or missing x-service-secret');
  }
}

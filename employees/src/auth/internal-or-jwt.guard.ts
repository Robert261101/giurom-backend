import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InternalServiceGuard } from '../auth/internal-service.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Injectable()
export class InternalOrJwtGuard implements CanActivate {
  constructor(
    private internalServiceGuard: InternalServiceGuard,
    private jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Dacă apelul provine de la serviciu intern (header secret), permită
    try {
      const okInternal = await Promise.resolve(
        this.internalServiceGuard.canActivate(context),
      );
      if (okInternal) return true;
    } catch (e) {
      // ignore
    }

    // Altfel, încearcă autentificarea JWT
    try {
      const okJwt = await Promise.resolve(this.jwtAuthGuard.canActivate(context));
      if (okJwt) return true;
    } catch (e) {
      // ignore
    }

    return false;
  }
}


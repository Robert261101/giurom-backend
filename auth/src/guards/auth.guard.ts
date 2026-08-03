import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  // Blacklist pentru token-uri invalidate (în producție ar trebui să fie în Redis/DB)
  private blacklistedTokens = new Set<string>();

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.bypassAuth) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Token de autentificare lipsă');
    }

    // Verifică dacă token-ul este în blacklist
    if (this.blacklistedTokens.has(token)) {
      throw new UnauthorizedException('Token invalidat prin logout');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token);
      
      // Asignează payload-ul la request pentru a fi accesibil în route handlers
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Token invalid');
    }
    
    return true;
  }

  // Metodă pentru a adăuga token în blacklist (folosită de AuthService)
  addToBlacklist(token: string): void {
    this.blacklistedTokens.add(token);
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
} 
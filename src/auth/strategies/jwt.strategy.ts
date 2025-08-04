import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Aici poți adăuga validări suplimentare dacă este necesar
    // De exemplu, verificarea dacă utilizatorul încă există în baza de date
    
    if (!payload.sub || !payload.permissions) {
      throw new UnauthorizedException('Token invalid');
    }

    return {
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      permissions: payload.permissions,
      roles: payload.roles,
    };
  }
}
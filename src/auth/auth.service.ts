import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(payload: JwtPayload): Promise<any> {
    // Aici poți adăuga logica de validare a utilizatorului
    // De exemplu, verificarea în baza de date
    return payload;
  }

  async generateToken(user: any): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      permissions: user.permissions || [],
      roles: user.roles || [],
    };

    return this.jwtService.sign(payload);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new Error('Token invalid');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TokenRotationService {
  private readonly logger = new Logger(TokenRotationService.name);
  private usedRefreshTokens = new Set<string>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  /**
   * Generează refresh token nou și invalidează vechiul
   */
  async rotateRefreshToken(oldRefreshToken: string): Promise<string> {
    try {
      // Verifică vechiul token
      const payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key'
      });

      if (payload.type !== 'refresh') {
        throw new Error('Token invalid - nu este refresh token');
      }

      // Verifică dacă token-ul a fost deja folosit
      if (this.usedRefreshTokens.has(oldRefreshToken)) {
        throw new Error('Refresh token deja folosit - posibil replay attack');
      }

      // Generează refresh token nou
      const newRefreshToken = await this.jwtService.signAsync(
        { 
          sub: payload.sub, 
          email: payload.email, 
          type: 'refresh',
          version: (payload.version || 0) + 1 // Incrementează versiunea
        },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d'
        }
      );

      // Marchează vechiul token ca folosit
      this.usedRefreshTokens.add(oldRefreshToken);
      
      // Curăță token-urile vechi (păstrează doar ultimele 1000)
      this.cleanupOldTokens();

      this.logger.log(`Refresh token rotit pentru utilizatorul ${payload.email}`);
      
      return newRefreshToken;
    } catch (error) {
      this.logger.error(`Eroare la rotirea refresh token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifică dacă un refresh token a fost deja folosit
   */
  async isRefreshTokenUsed(token: string): Promise<boolean> {
    return this.usedRefreshTokens.has(token);
  }

  /**
   * Invalidează un refresh token (la logout)
   */
  async invalidateRefreshToken(token: string): Promise<void> {
    this.usedRefreshTokens.add(token);
    this.logger.log('Refresh token invalidat');
  }

  /**
   * Curăță token-urile vechi din memorie
   */
  private cleanupOldTokens(): void {
    if (this.usedRefreshTokens.size > 1000) {
      const tokensArray = Array.from(this.usedRefreshTokens);
      this.usedRefreshTokens = new Set(tokensArray.slice(-500)); // Păstrează doar ultimele 500
    }
  }

  /**
   * Generează un nou set de token-uri cu rotire
   */
  async generateTokensWithRotation(user: any, oldRefreshToken?: string): Promise<{ access_token: string; refresh_token: string }> {
    // Generează access token cu informații despre partener
    const accessPayload = { 
      sub: user.userId, 
      email: user.email,
      partner_id: user.partner_id || null,
      partner_name: user.partner_name || null,
      roles: user.roles?.map(role => role.name) || ['partner'],
      permissions: user.roles?.flatMap(role => 
        role.permissions?.map(permission => permission.name) || []
      ) || []
    };
    
    const accessToken = await this.jwtService.signAsync(accessPayload);
    
    // Generează refresh token nou cu informații despre partener
    const refreshToken = await this.jwtService.signAsync(
      { 
        sub: user.userId, 
        email: user.email,
        partner_id: user.partner_id || null,
        partner_name: user.partner_name || null,
        type: 'refresh',
        version: 1
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d'
      }
    );

    // Invalidează vechiul refresh token dacă există
    if (oldRefreshToken) {
      await this.invalidateRefreshToken(oldRefreshToken);
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken
    };
  }
} 
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
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
      if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET nu este configurat în variabilele de mediu');
      }
      const payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: refreshSecret
      });

      if (payload.type !== 'refresh') {
        throw new Error('Token invalid - nu este refresh token');
      }

      // Verifică dacă token-ul a fost deja folosit
      if (this.usedRefreshTokens.has(oldRefreshToken)) {
        throw new Error('Refresh token deja folosit - posibil replay attack');
      }

      // Generează refresh token nou (folosim refreshSecret deja declarat)
      const newRefreshToken = await this.jwtService.signAsync(
        { 
          sub: payload.sub, 
          type: 'refresh',
          version: (payload.version || 0) + 1 // Incrementează versiunea
        },
        {
          secret: refreshSecret,
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d'
        }
      );

      // Marchează vechiul token ca folosit
      this.usedRefreshTokens.add(oldRefreshToken);
      
      // Curăță token-urile vechi (păstrează doar ultimele 1000)
      this.cleanupOldTokens();

      this.logger.log(`Refresh token rotit pentru utilizatorul ID ${payload.sub}`);
      
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
    // Generează access token cu informații despre utilizator
    const accessPayload = { 
      sub: user.id, 
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      profile_image: user.profile_image,
      birth_date: user.birth_date || '',
      department_id: user.department_id || null,
      work_location_id: user.work_location_id || null,
      company_id: user.company_id ?? null,
      company_type: user.company_type ?? null,
      roles: user.roles || [],
      permissions: user.permissions || []
    };
    
    const accessToken = await this.jwtService.signAsync(accessPayload);
    
    // Generează refresh token nou cu informații despre utilizator
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET nu este configurat în variabilele de mediu');
    }
    const refreshToken = await this.jwtService.signAsync(
      { 
        sub: user.id, 
        email: user.email || '',
        phone: user.phone || '',
        type: 'refresh',
        version: 1
      },
      {
        secret: refreshSecret,
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
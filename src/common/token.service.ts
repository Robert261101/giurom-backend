import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  
  // Tracking pentru token-uri active per utilizator (în producție ar trebui să fie în Redis/DB)
  private activeTokens = new Map<number, Set<string>>();
  private refreshTokens = new Map<number, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService
  ) {}

  /**
   * Generează access token și refresh token pentru un utilizator
   */
  async generateTokens(user: any): Promise<{ access_token: string; refresh_token: string }> {
    // Extrage rolurile și permisiunile
    const roles = user.roles?.map(role => role.name) || ['partner'];
    const permissions = user.roles?.flatMap(role => 
      role.permissions?.map(permission => permission.name) || []
    ) || [];

    // Generează access token (15 minute)
    const accessPayload = { 
      sub: user.userId, 
      roles: roles,
      permissions: permissions
    };
    const accessToken = await this.jwtService.signAsync(accessPayload);
    
    // Generează refresh token (7 zile) - fără roluri și permisiuni
    const refreshPayload = { 
      sub: user.userId, 
      type: 'refresh'
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d'
    });
    
    // Adaugă token-urile la tracking
    this.addActiveToken(user.userId, accessToken);
    this.addRefreshToken(user.userId, refreshToken);

    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    this.logger.log(`Tokens generate pentru utilizatorul ID ${user.userId} - Access: ${accessExpiresIn}, Refresh: ${refreshExpiresIn}`);
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Reînnoiește access token-ul folosind refresh token-ul
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Verifică refresh token-ul cu secret-ul pentru refresh
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key'
      });

      if (payload.type !== 'refresh') {
        throw new Error('Token invalid - nu este refresh token');
      }

      // Verifică dacă refresh token-ul este în lista de token-uri valide
      const userRefreshTokens = this.refreshTokens.get(payload.sub);
      if (!userRefreshTokens || !userRefreshTokens.has(refreshToken)) {
        throw new Error('Refresh token invalidat');
      }

      // Obține utilizatorul
      const user = await this.usersService.findByEmployeeIdWithPassword(payload.sub);
      if (!user) {
        throw new Error('Utilizatorul nu a fost găsit');
      }

      // Generează token-uri noi
      const newTokens = await this.generateTokens(user);

      // Înlocuiește token-urile vechi cu cele noi
      this.removeRefreshToken(payload.sub, refreshToken);
      this.addRefreshToken(payload.sub, newTokens.refresh_token);
      this.addActiveToken(payload.sub, newTokens.access_token);

      const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
      const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
      this.logger.log(`Tokens reînnoite pentru utilizatorul ID ${user.id_employee} - Access: ${accessExpiresIn}, Refresh: ${refreshExpiresIn}`);

      return newTokens;
    } catch (error) {
      this.logger.error(`Eroare la reînnoirea token-ului: ${error.message}`);
      throw error;
    }
  }

  /**
   * Revocă toate token-urile pentru un utilizator
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    try {
      // Obține toate token-urile active pentru utilizator
      const userTokens = this.activeTokens.get(userId);
      const userRefreshTokens = this.refreshTokens.get(userId);
      
      if (userTokens && userTokens.size > 0) {
        // Șterge toate token-urile din tracking
        this.activeTokens.delete(userId);
        this.logger.log(`${userTokens.size} access token-uri revocate pentru utilizatorul cu ID: ${userId}`);
      }

      if (userRefreshTokens && userRefreshTokens.size > 0) {
        // Șterge toate refresh token-urile
        this.refreshTokens.delete(userId);
        this.logger.log(`${userRefreshTokens.size} refresh token-uri revocate pentru utilizatorul cu ID: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Eroare la revocarea token-urilor: ${error.message}`);
      throw error;
    }
  }

  /**
   * Adaugă un token în blacklist (pentru logout)
   */
  addToBlacklist(token: string): void {
    // În implementarea actuală, token-urile sunt revocate complet
    // În producție ar trebui să fie în Redis/DB
    this.logger.log(`Token adăugat în blacklist: ${token.substring(0, 20)}...`);
  }

  // Metode helper pentru tracking token-uri
  private addActiveToken(userId: number, token: string): void {
    if (!this.activeTokens.has(userId)) {
      this.activeTokens.set(userId, new Set());
    }
    this.activeTokens.get(userId)!.add(token);
  }

  private addRefreshToken(userId: number, token: string): void {
    if (!this.refreshTokens.has(userId)) {
      this.refreshTokens.set(userId, new Set());
    }
    this.refreshTokens.get(userId)!.add(token);
  }

  private removeActiveToken(userId: number, token: string): void {
    const userTokens = this.activeTokens.get(userId);
    if (userTokens) {
      userTokens.delete(token);
      if (userTokens.size === 0) {
        this.activeTokens.delete(userId);
      }
    }
  }

  private removeRefreshToken(userId: number, token: string): void {
    const userRefreshTokens = this.refreshTokens.get(userId);
    if (userRefreshTokens) {
      userRefreshTokens.delete(token);
      if (userRefreshTokens.size === 0) {
        this.refreshTokens.delete(userId);
      }
    }
  }
} 
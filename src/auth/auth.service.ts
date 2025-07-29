import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../guards/auth.guard';
import { TokenService } from '../common/token.service';
import { BruteForceProtectionService } from '../common/security/brute-force.service';
import { TokenRotationService } from '../common/security/token-rotation.service';
import { SecurityAlertsService, SecurityEventType } from '../common/security/security-alerts.service';
import { AnomalyDetectionService } from '../common/security/anomaly-detection.service';
import * as bcrypt from 'bcryptjs';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  


  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private authGuard: AuthGuard,
    private tokenService: TokenService,
    private bruteForceService: BruteForceProtectionService,
    private tokenRotationService: TokenRotationService,
    private securityAlertsService: SecurityAlertsService,
    private anomalyDetectionService: AnomalyDetectionService
  ) {}

  async signIn(
    identifier: string,
    pass: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    // Detectează dacă este email sau telefon
    const isEmail = this.isValidEmail(identifier);
    const isPhone = this.isValidPhone(identifier);

    if (!isEmail && !isPhone) {
      throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
    }

    // Verifică protecția împotriva brute force
    try {
      await this.bruteForceService.checkBruteForce(identifier);
    } catch (error) {
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.ACCOUNT_LOCKED,
        email: identifier,
        ipAddress,
        userAgent,
        details: `Cont blocat temporar: ${error.message}`,
        severity: 'HIGH',
        timestamp: new Date()
      });
      throw error;
    }

    let user;
    
    if (isEmail) {
      user = await this.usersService.findOne(identifier);
    } else {
      user = await this.usersService.findOneByPhone(identifier);
    }

    if (!user) {
      // Înregistrează încercarea eșuată
      await this.bruteForceService.recordFailedAttempt(identifier);
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        email: identifier,
        ipAddress,
        userAgent,
        details: 'Utilizator inexistent',
        severity: 'MEDIUM',
        timestamp: new Date()
      });
      throw new UnauthorizedException('Utilizatorul nu a fost găsit');
    }

    // Verifică parola folosind bcrypt
    const isPasswordValid = await bcrypt.compare(pass, user.password);
    if (!isPasswordValid) {
      // Înregistrează încercarea eșuată
      await this.bruteForceService.recordFailedAttempt(identifier);
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        userId: user.userId.toString(),
        email: user.email,
        ipAddress,
        userAgent,
        details: 'Parolă incorectă',
        severity: 'MEDIUM',
        timestamp: new Date()
      });
      throw new UnauthorizedException('Parola incorectă');
    }

    // Detectează anomalii în comportament
    const anomalyScore = await this.anomalyDetectionService.detectAnomalies(
      user.userId.toString(),
      'LOGIN',
      {
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: true
      }
    );

    // Log eveniment suspect dacă scorul este ridicat
    if (anomalyScore.score > 70) {
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_LOGIN,
        userId: user.userId.toString(),
        email: user.email,
        ipAddress,
        userAgent,
        details: `Login suspect - scor anomalie: ${anomalyScore.score}/100. Factori: ${anomalyScore.factors.join(', ')}`,
        severity: anomalyScore.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        timestamp: new Date()
      });
    }

    // Resetează încercările eșuate la login reușit
    await this.bruteForceService.resetAttempts(identifier);

    // Generează token-urile cu rotire
    return await this.tokenRotationService.generateTokensWithRotation(user);
  }

  async logout(token: string): Promise<{ message: string }> {
    try {
      // Verifică dacă token-ul este valid înainte de a-l invalida
      const payload = await this.jwtService.verifyAsync(token);
      
      // Adaugă token-ul în blacklist prin AuthGuard
      this.authGuard.addToBlacklist(token);
      
      // Revocă toate token-urile pentru utilizatorul respectiv
      await this.tokenService.revokeAllUserTokens(payload.sub);
      
      this.logger.log(`Logout complet pentru utilizatorul ${payload.email} - toate token-urile revocate`);
      
      return { 
        message: 'Logout realizat cu succes - toate sesiunile au fost închise' 
      };
    } catch (error) {
      throw new UnauthorizedException('Token invalid');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Folosește rotirea de token-uri pentru securitate sporită
      const newRefreshToken = await this.tokenRotationService.rotateRefreshToken(refreshToken);
      
      // Generează access token nou
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
      });
      
      const user = await this.usersService.findOne(payload.email);
      if (!user) {
        throw new Error('Utilizatorul nu a fost găsit');
      }
      
      const accessToken = await this.jwtService.signAsync({
        sub: user.userId,
        email: user.email,
        roles: user.roles?.map(role => role.name) || [],
        permissions: user.roles?.flatMap(role => 
          role.permissions?.map(permission => permission.name) || []
        ) || []
      });
      
      return {
        access_token: accessToken,
        refresh_token: newRefreshToken
      };
    } catch (error) {
      this.logger.error(`Eroare la reînnoirea token-ului: ${error.message}`);
      throw new UnauthorizedException('Refresh token invalid');
    }
  }

  async revokeAllUserTokens(userId: number): Promise<{ message: string }> {
    try {
      await this.tokenService.revokeAllUserTokens(userId);
      return { 
        message: `Toate token-urile pentru utilizatorul ${userId} au fost revocate` 
      };
    } catch (error) {
      this.logger.error(`Eroare la revocarea token-urilor: ${error.message}`);
      throw error;
    }
  }

  async validateIdentifier(identifier: string): Promise<{ exists: boolean; type: 'email' | 'phone' }> {
    // Detectează dacă este email sau telefon
    const isEmail = this.isValidEmail(identifier);
    const isPhone = this.isValidPhone(identifier);

    if (!isEmail && !isPhone) {
      throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
    }

    let user;
    
    if (isEmail) {
      user = await this.usersService.findOne(identifier);
    } else {
      user = await this.usersService.findOneByPhone(identifier);
    }

    return {
      exists: !!user,
      type: isEmail ? 'email' : 'phone'
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^07[0-9]{8}$/;
    return phoneRegex.test(phone);
  }
} 
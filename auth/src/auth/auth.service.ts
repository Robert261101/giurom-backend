import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../guards/auth.guard';
import { TokenService } from '../common/token.service';
import { BruteForceProtectionService } from '../common/security/brute-force.service';
import { TokenRotationService } from '../common/security/token-rotation.service';
import { SecurityAlertsService, SecurityEventType } from '../common/security/security-alerts.service';
import { AnomalyDetectionService } from '../common/security/anomaly-detection.service';
import { TwoFactorAuthService } from '../2fa-auth/2fa-auth.service';
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
    private anomalyDetectionService: AnomalyDetectionService,
    private twoFactorAuthService: TwoFactorAuthService
  ) {}

  async signIn(
    identifier: string,
    pass: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ access_token?: string; refresh_token?: string; requires_2fa?: boolean; userId?: number; message?: string }> {
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

    let user: User | undefined;
    
    if (isEmail) {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByEmail(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    } else {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByPhone(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    }

    if (!user) {
      // Înregistrează încercarea eșuată
      await this.bruteForceService.recordFailedAttempt(identifier);
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        email: identifier,
        ipAddress,
        userAgent,
        details: 'Angajat inexistent',
        severity: 'MEDIUM',
        timestamp: new Date()
      });
      throw new UnauthorizedException('Angajatul nu a fost găsit');
    }

    // Verifică parola folosind bcrypt
    const isPasswordValid = await bcrypt.compare(pass, user.password || '');
    if (!isPasswordValid) {
      // Înregistrează încercarea eșuată
      await this.bruteForceService.recordFailedAttempt(identifier);
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        userId: user.id.toString(),
        email: identifier,
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
      user.id.toString(),
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
        userId: user.id.toString(),
        email: identifier,
        ipAddress,
        userAgent,
        details: `Login suspect - scor anomalie: ${anomalyScore.score}/100. Factori: ${anomalyScore.factors.join(', ')}`,
        severity: anomalyScore.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        timestamp: new Date()
      });
    }

    // Resetează încercările eșuate la login reușit
    await this.bruteForceService.resetAttempts(identifier);

    // Verifică dacă utilizatorul are 2FA activat
    if (user.is_2fa) {
      this.logger.log(`Utilizatorul ${identifier} are 2FA activat. Se trimite OTP automat.`);
      
      try {
        // Trimite OTP-ul automat folosind serviciul injectat
        const result = await this.twoFactorAuthService.step1Login(identifier, pass);
        
        this.logger.log(`OTP trimis cu succes pentru ${identifier}`);
        
        return {
          requires_2fa: true,
          userId: result.userId,
          message: result.message
        };
      } catch (error) {
        this.logger.error(`Eroare la trimiterea OTP pentru ${identifier}: ${error.message}`);
        throw new UnauthorizedException('Autentificarea cu parolă a reușit, dar nu s-a putut trimite OTP-ul. Încearcă din nou.');
      }
    }

    // Dacă nu are 2FA activat, generează token-urile normal
    // Preia datele complete din microserviciul employees
    let employeeData: any = null;
    if (isEmail) {
      employeeData = await this.usersService.findEmployeeByEmail(identifier);
    } else {
      employeeData = await this.usersService.findEmployeeByPhone(identifier);
    }

    // Obține roles și permissions pentru utilizator (folosind user.id, nu user.id_employee)
    const { roles, permissions } = await this.usersService.getUserRolesAndPermissions(user.id);

    const userDataForToken = {
      id: user.id_employee,
      email: employeeData?.email || '',
      first_name: employeeData?.first_name || '',
      last_name: employeeData?.last_name || '',
      phone: employeeData?.phone || '',
      profile_image: this.convertToApiProxyUrl(user.profile_image),
      birth_date: employeeData?.birth_date || '',
      department_id: employeeData?.department_default_id || null,
      work_location_id: employeeData?.work_location_default_id || null,
      roles: roles, // Include user roles (array de string-uri)
      permissions: permissions, // Include user permissions (array de string-uri)
      is_2fa_active: user.is_2fa
    };

    const tokens = await this.tokenRotationService.generateTokensWithRotation(userDataForToken);
    
    // Log utilizatorul și permisiunile sale
    this.logger.log(`=== LOGIN REUȘIT (FĂRĂ 2FA) ===`);
    this.logger.log(`Utilizator ID: ${user.id_employee}`);
    this.logger.log(`2FA Status: ${user.is_2fa ? 'ACTIVAT' : 'DEZACTIVAT'}`);
    this.logger.log(`Roluri: ${userDataForToken.roles.join(', ')}`);
    this.logger.log(`Permisiuni: ${userDataForToken.permissions.join(', ')}`);
    this.logger.log(`====================`);
    
    return tokens;
  }

  async logout(token: string): Promise<{ message: string }> {
    try {
      // Verifică dacă token-ul este valid înainte de a-l invalida
      const payload = await this.jwtService.verifyAsync(token);
      
      // Adaugă token-ul în blacklist prin AuthGuard
      this.authGuard.addToBlacklist(token);
      
      // Revocă toate token-urile pentru utilizatorul respectiv
      await this.tokenService.revokeAllUserTokens(payload.sub);
      
      this.logger.log(`Logout complet pentru utilizatorul ID ${payload.sub} - toate token-urile revocate`);
      
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
      const refreshSecret = process.env.JWT_REFRESH_SECRET;
      if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET nu este configurat în variabilele de mediu');
      }
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret
      });
      
      // Găsește user-ul local după id_employee din payload
      const user = await this.usersService.findByEmployeeIdWithPassword(payload.sub);
      if (!user) {
        throw new Error('Utilizatorul nu a fost găsit');
      }
      
      // Preia datele complete din microserviciul employees folosind id_employee direct
      this.logger.log(`🔍 Refresh token payload:`, payload);
      // Folosim user.id_employee direct pentru a obține datele employee-ului
      const employeeData: any = await this.usersService.findEmployeeById(user.id_employee);
      
      if (!employeeData) {
        this.logger.warn(`⚠️ Nu s-au găsit date pentru employee cu ID ${user.id_employee} - folosim date alternative`);
        // Dacă nu găsim prin ID, încercăm prin email sau phone din payload (pentru compatibilitate cu token-uri vechi)
        const fallbackData = await this.usersService.findEmployeeByEmail(payload.email || '') || 
                            (payload.phone ? await this.usersService.findEmployeeByPhone(payload.phone) : null);
        if (fallbackData) {
          Object.assign(employeeData || {}, fallbackData);
        }
      }

      // Obține roles și permissions pentru utilizator (folosind user.id, nu user.id_employee)
      const { roles, permissions } = await this.usersService.getUserRolesAndPermissions(user.id);

      const jwtPayload = {
        sub: user.id_employee,
        email: employeeData?.email || '',
        first_name: employeeData?.first_name || '',
        last_name: employeeData?.last_name || '',
        phone: employeeData?.phone || '',
        profile_image: this.convertToApiProxyUrl(user.profile_image),
        birth_date: employeeData?.birth_date || '',
        department_id: employeeData?.department_default_id || null,
        work_location_id: employeeData?.work_location_default_id || null,
        roles: roles, // Include user roles (array de string-uri)
        permissions: permissions, // Include user permissions (array de string-uri)
      };
      
      const accessToken = await this.jwtService.signAsync(jwtPayload);
      
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

    let user: User | undefined;
    
    if (isEmail) {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByEmail(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    } else {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByPhone(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
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
    // Acceptă formatul 07XXXXXXXX sau +407XXXXXXXX
    const phoneRegex = /^(\+40)?7[0-9]{8}$/;
    return phoneRegex.test(phone);
  }

  // Helper method to convert direct file path to API proxy URL
  private convertToApiProxyUrl(profileImageUrl: string | null): string | null {
    if (!profileImageUrl) {
      return null;
    }
    
    // If this is already an API proxy URL, return as is
    if (profileImageUrl.startsWith('/api/')) {
      return profileImageUrl;
    }
    
    // If this is a direct file path, it means we need to handle it properly
    // For now, we'll return null to use the default avatar
    // In a real implementation, we would need to find the file ID and create the proper URL
    if (profileImageUrl.startsWith('/files/')) {
      // This is a direct file path that can't be accessed directly
      // Return null to use default avatar until we can properly convert it
      return null;
    }
    
    // For any other URL, return as is
    return profileImageUrl;
  }
} 
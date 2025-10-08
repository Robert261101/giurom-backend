import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../common/token.service';
import { TokenRotationService } from '../common/security/token-rotation.service';
import { UsersService } from '../users/users.service';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';

interface OtpRecord {
  email: string;
  phone: string;
  otp: string;
  expiresAt: Date;
  userId: number;
  userData: any; // Stochează datele utilizatorului pentru pasul 2
}

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://www.smsadvert.ro/api/sms/';
  
  // Stocare temporară pentru OTP-uri (în producție ar trebui să fie în DB)
  private otpStorage = new Map<string, OtpRecord>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly tokenRotationService: TokenRotationService,
    private readonly usersService: UsersService,
  ) {
    this.apiKey = this.configService.get<string>('MOBILE_SMS_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('MOBILE_SMS_API_KEY nu este configurat!');
    }
  }

  async step1Login(identifier: string, password: string): Promise<{ message: string; userId: number }> {
    try {
      // Detectează dacă este email sau telefon
      const isEmail = this.isValidEmail(identifier);
      const isPhone = this.isValidPhone(identifier);

      if (!isEmail && !isPhone) {
        throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
      }

      // Caută utilizatorul
      let user;
      if (isEmail) {
        user = await this.findUserByEmail(identifier);
      } else {
        user = await this.findUserByPhone(identifier);
      }

      if (!user) {
        throw new UnauthorizedException('Credențiale invalide');
      }

      // Verifică parola
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Credențiale invalide');
      }

      if (!user.phone) {
        throw new NotFoundException('Utilizatorul nu are număr de telefon asociat');
      }

      // Generează OTP
      const otp = this.generateOtp();
      
      // Trimite SMS
      const smsSent = await this.sendSms(user.phone, otp);
      if (!smsSent) {
        throw new Error('Nu s-a putut trimite SMS-ul');
      }

      // Salvează OTP-ul cu datele utilizatorului (expiră în 5 minute)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      this.logger.log(`🔍 DEBUG: Salvare OTP cu cheia: ${user.userId.toString()}`);
      this.logger.log(`🔍 DEBUG: OTP Storage keys înainte: ${Array.from(this.otpStorage.keys()).join(', ')}`);
      
      this.otpStorage.set(user.userId.toString(), {
        email: user.email,
        phone: user.phone,
        otp,
        expiresAt,
        userId: user.userId,
        userData: user // Stochează datele pentru pasul 2
      });
      
      this.logger.log(`🔍 DEBUG: OTP Storage keys după: ${Array.from(this.otpStorage.keys()).join(', ')}`);

      this.logger.log(`Autentificare pas 1 reușită pentru ${user.email}, OTP trimis pe ${user.phone}`);
      this.logger.log(`OTP generat: ${otp} (pentru debugging)`);
      
      return { 
        message: `OTP trimis cu succes pe numărul ${user.phone}. Introduceți codul pentru a finaliza autentificarea.`,
        userId: user.userId
      };
    } catch (error) {
      this.logger.error(`Eroare la pasul 1: ${error.message}`);
      throw error;
    }
  }

  async step2Verify(userId: number, otp: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      this.logger.log(`🔍 DEBUG: Verificare OTP pentru userId: ${userId}, otp: ${otp}`);
      this.logger.log(`🔍 DEBUG: OTP Storage keys: ${Array.from(this.otpStorage.keys()).join(', ')}`);
      
      // Caută OTP-ul în toate înregistrările pentru a găsi cea cu userId-ul corect
      let otpRecord: OtpRecord | null = null;
      for (const [key, record] of this.otpStorage.entries()) {
        if (record.userId === userId) {
          otpRecord = record;
          this.logger.log(`🔍 DEBUG: OTP Record găsit cu cheia: ${key}`);
          break;
        }
      }
      
      this.logger.log(`🔍 DEBUG: OTP Record găsit: ${otpRecord ? 'DA' : 'NU'}`);
      
      if (!otpRecord) {
        throw new UnauthorizedException('OTP invalid sau expirat. Completați din nou pasul 1.');
      }

      this.logger.log(`🔍 DEBUG: Comparare OTP - Stocat: "${otpRecord.otp}", Trimis: "${otp}"`);
      this.logger.log(`🔍 DEBUG: OTP-uri identice: ${otpRecord.otp === otp}`);
      
      if (otpRecord.otp !== otp) {
        this.logger.error(`🔍 DEBUG: OTP INCORECT - Stocat: "${otpRecord.otp}", Trimis: "${otp}"`);
        throw new UnauthorizedException('OTP incorect');
      }

      if (otpRecord.expiresAt <= new Date()) {
        // Șterge înregistrarea expirată
        for (const [key, record] of this.otpStorage.entries()) {
          if (record.userId === userId) {
            this.otpStorage.delete(key);
            break;
          }
        }
        throw new UnauthorizedException('OTP expirat. Completați din nou pasul 1.');
      }

      // OTP valid - generează token-urile folosind TokenService
      const user = otpRecord.userData;
      this.logger.log(`🔍 DEBUG: userData din otpRecord: ${JSON.stringify(user)}`);
      this.logger.log(`🔍 DEBUG: userData este null/undefined: ${user === null || user === undefined}`);
      
      if (!user) {
        this.logger.error(`🔍 DEBUG: userData este null sau undefined!`);
        throw new UnauthorizedException('Date utilizator lipsă. Completați din nou pasul 1.');
      }
      
      this.logger.log(`🔍 DEBUG: Încep generarea token-urilor pentru user: ${JSON.stringify(user)}`);
      
      try {
        // Preia datele complete ale utilizatorului din microserviciul employees
        const employeeData = await this.usersService.findEmployeeByEmail(user.email);
        this.logger.log(`🔍 DEBUG: Employee data: ${JSON.stringify(employeeData)}`);
        
        // Pregătește datele complete pentru token
        const userDataForToken = {
          id: user.userId,
          email: employeeData?.email || user.email,
          first_name: employeeData?.first_name || '',
          last_name: employeeData?.last_name || '',
          phone: employeeData?.phone || user.phone,
          profile_image: user.profile_image,
          birth_date: employeeData?.birth_date || '',
          department_id: null,
          work_location_id: null,
          roles: user.roles || [],
          permissions: user.permissions || [],
          is_2fa_active: true
        };
        
        this.logger.log(`🔍 DEBUG: User data for token: ${JSON.stringify(userDataForToken)}`);
        
        const tokens = await this.tokenRotationService.generateTokensWithRotation(userDataForToken);
        this.logger.log(`🔍 DEBUG: Token-uri generate cu succes: ${JSON.stringify(tokens)}`);

        // Șterge OTP-ul după verificare
        for (const [key, record] of this.otpStorage.entries()) {
          if (record.userId === userId) {
            this.otpStorage.delete(key);
            break;
          }
        }

        this.logger.log(`Autentificare 2FA completă pentru ${user.email}`);
        return tokens;
      } catch (tokenError) {
        this.logger.error(`🔍 DEBUG: Eroare la generarea token-urilor: ${tokenError.message}`);
        throw tokenError;
      }
    } catch (error) {
      this.logger.error(`🔍 DEBUG: Eroare în step2Verify: ${error.message}`);
      this.logger.error(`🔍 DEBUG: Stack trace: ${error.stack}`);
      throw error;
    }
  }

  private async findUserByEmail(email: string): Promise<any> {
    try {
      // Găsește employee-ul prin email
      const employeeData = await this.usersService.findEmployeeByEmail(email);
      if (!employeeData) {
        return null;
      }

      // Găsește user-ul local prin id_employee
      const user = await this.usersService.findByEmployeeIdWithPassword(employeeData.id);
      if (!user) {
        return null;
      }

      return {
        userId: user.id,
        email: employeeData.email,
        phone: employeeData.phone,
        password: user.password,
        profile_image: user.profile_image, // Include poza de profil
        roles: [] // TODO: Implementează rolurile dacă sunt necesare
      };
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului: ${error.message}`);
      return null;
    }
  }

  private async findUserByPhone(phone: string): Promise<any> {
    try {
      // Găsește employee-ul prin telefon
      const employeeData = await this.usersService.findEmployeeByPhone(phone);
      if (!employeeData) {
        return null;
      }

      // Găsește user-ul local prin id_employee
      const user = await this.usersService.findByEmployeeIdWithPassword(employeeData.id);
      if (!user) {
        return null;
      }

      return {
        userId: user.id,
        email: employeeData.email,
        phone: employeeData.phone,
        password: user.password,
        profile_image: user.profile_image, // Include poza de profil
        roles: [] // TODO: Implementează rolurile dacă sunt necesare
      };
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului după telefon: ${error.message}`);
      return null;
    }
  }

  private async sendSms(phone: string, otp: string): Promise<boolean> {
    try {
      const data = {
        phone,
        shortTextMessage: `Codul dvs de verificare este: ${otp}. Expiră în 5 minute.`,
        sendAsShort: true
      };

      const config = {
        method: 'post',
        url: this.apiUrl,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        data: data
      };

      const response = await axios(config);

      if (response.data.successMessage) {
        this.logger.log(`SMS trimis cu succes către ${phone}. Message ID: ${response.data.msgId}`);
        this.logger.log(`OTP trimis prin SMS: ${otp} (pentru debugging)`);
        return true;
      } else {
        this.logger.error(`Eroare la trimiterea SMS: ${JSON.stringify(response.data.errors)}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Eroare la trimiterea SMS: ${error.message}`);
      return false;
    }
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^(\+40)?7[0-9]{8}$/;
    return phoneRegex.test(phone);
  }
} 
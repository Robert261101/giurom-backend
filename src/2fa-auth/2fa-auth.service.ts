import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../common/token.service';
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
      this.otpStorage.set(user.userId.toString(), {
        email: user.email,
        phone: user.phone,
        otp,
        expiresAt,
        userId: user.userId,
        userData: user // Stochează datele pentru pasul 2
      });

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
      // Verifică OTP-ul folosind userId ca cheie
      const otpRecord = this.otpStorage.get(userId.toString());
      if (!otpRecord) {
        throw new UnauthorizedException('OTP invalid sau expirat. Completați din nou pasul 1.');
      }

      if (otpRecord.otp !== otp) {
        throw new UnauthorizedException('OTP incorect');
      }

      if (otpRecord.expiresAt <= new Date()) {
        this.otpStorage.delete(userId.toString());
        throw new UnauthorizedException('OTP expirat. Completați din nou pasul 1.');
      }

      // OTP valid - generează token-urile folosind TokenService
      const user = otpRecord.userData;
      const tokens = await this.tokenService.generateTokens(user);

      // Șterge OTP-ul după verificare
      this.otpStorage.delete(userId.toString());

      this.logger.log(`Autentificare 2FA completă pentru ${user.email}`);

      return tokens;
    } catch (error) {
      this.logger.error(`Eroare la pasul 2: ${error.message}`);
      throw error;
    }
  }

  private async findUserByEmail(email: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3003/users?email=${email}`, {
          params: {
            include: 'roles,roles.permissions'
          }
        })
      );

      if (response?.data?.data?.data?.length) {
        const userData = response.data.data.data[0];
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        
        // Include și rolul de bază din obiectul user
        const baseRole = userData.user.role;
        const allRoles = [...userRoles];
        
        // Adaugă rolul de bază dacă nu există deja în lista de roluri
        if (baseRole && !allRoles.find(role => role.name === baseRole)) {
          allRoles.push({ name: baseRole, permissions: [] });
        }

        return {
          userId: userData.user.id,
          email: userData.user.email,
          phone: userData.user.phone,
          password: userData.user.password,
          roles: allRoles
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului: ${error.message}`);
      return null;
    }
  }

  private async findUserByPhone(phone: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3003/users?phone=${phone}`, {
          params: {
            include: 'roles,roles.permissions'
          }
        })
      );

      if (response?.data?.data?.data?.length) {
        const userData = response.data.data.data[0];
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        
        // Include și rolul de bază din obiectul user
        const baseRole = userData.user.role;
        const allRoles = [...userRoles];
        
        // Adaugă rolul de bază dacă nu există deja în lista de roluri
        if (baseRole && !allRoles.find(role => role.name === baseRole)) {
          allRoles.push({ name: baseRole, permissions: [] });
        }

        return {
          userId: userData.user.id,
          email: userData.user.email,
          phone: userData.user.phone,
          password: userData.user.password,
          roles: allRoles
        };
      }

      return null;
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
    const phoneRegex = /^07[0-9]{8}$/;
    return phoneRegex.test(phone);
  }
} 
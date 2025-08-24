import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../common/token.service';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import axios from 'axios';

interface OtpRecord {
  email: string;
  phone: string;
  otp: string;
  expiresAt: Date;
  userId: number;
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
      this.logger.error('MOBILE_SMS_API_KEY nu este configurat! SMS-urile nu vor fi trimise.');
      this.logger.error('Setează variabila de mediu MOBILE_SMS_API_KEY cu cheia ta de la SMSAdvert.');
    } else {
      this.logger.log('MOBILE_SMS_API_KEY configurat cu succes.');
    }
  }

  async sendOtp(identifier: string): Promise<{ message: string }> {
    try {
      // Detectează dacă este email sau telefon
      const isEmail = this.isValidEmail(identifier);
      const isPhone = this.isValidPhone(identifier);

      if (!isEmail && !isPhone) {
        throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
      }

      let user;
      let userIdentifier;
      
      if (isEmail) {
        user = await this.findUserByEmail(identifier);
        userIdentifier = identifier;
      } else {
        user = await this.findUserByPhone(identifier);
        userIdentifier = user?.email || identifier; // Folosește email-ul pentru stocare
      }

      if (!user) {
        throw new NotFoundException('Utilizatorul nu a fost găsit');
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

      // Salvează OTP-ul (expiră în 5 minute)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      this.otpStorage.set(userIdentifier, {
        email: user.email,
        phone: user.phone,
        otp,
        expiresAt,
        userId: user.userId
      });

      this.logger.log(`OTP trimis cu succes către ${user.phone} pentru ${user.email}`);
      // Log OTP pentru debugging în dezvoltare
      this.logger.log(`OTP generat: ${otp} (pentru debugging)`);
      
      return { 
        message: `OTP trimis cu succes pe numărul ${user.phone}` 
      };
    } catch (error) {
      this.logger.error(`Eroare la trimiterea OTP: ${error.message}`);
      throw error;
    }
  }

  async verifyOtp(identifier: string, otp: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Detectează dacă este email sau telefon
      const isEmail = this.isValidEmail(identifier);
      const isPhone = this.isValidPhone(identifier);

      if (!isEmail && !isPhone) {
        throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
      }

      let user;
      let userIdentifier;
      
      if (isEmail) {
        user = await this.findUserByEmail(identifier);
        userIdentifier = identifier;
      } else {
        user = await this.findUserByPhone(identifier);
        userIdentifier = user?.email || identifier; // Folosește email-ul pentru stocare
      }

      if (!user) {
        throw new NotFoundException('Utilizatorul nu a fost găsit');
      }

      // Verifică OTP-ul
      const otpRecord = this.otpStorage.get(userIdentifier);
      if (!otpRecord) {
        throw new UnauthorizedException('OTP invalid sau expirat');
      }

      if (otpRecord.otp !== otp) {
        throw new UnauthorizedException('OTP incorect');
      }

      if (otpRecord.expiresAt <= new Date()) {
        this.otpStorage.delete(userIdentifier);
        throw new UnauthorizedException('OTP expirat');
      }

      // Generează token-urile folosind TokenService
      const tokens = await this.tokenService.generateTokens(user);

      // Șterge OTP-ul după verificare
      this.otpStorage.delete(userIdentifier);

      this.logger.log(`Autentificare OTP reușită pentru ${user.email}`);

      return tokens;
    } catch (error) {
      this.logger.error(`Eroare la verificarea OTP: ${error.message}`);
      throw error;
    }
  }

  private async findUserByEmail(email: string): Promise<any> {
    try {
      this.logger.log(`Căutând utilizatorul cu email: ${email}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3003/users?email=${email}`, {
          params: {
            include: 'roles,roles.permissions'
          }
        })
      );

      // Verifică dacă răspunsul are structura corectă
      if (response?.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        const userData = response.data.data[0];
        
        // Verifică dacă utilizatorul are număr de telefon
        if (!userData.user.phone) {
          this.logger.error(`Utilizatorul ${email} nu are număr de telefon asociat`);
          return null;
        }

        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        
        // Include și rolul de bază din obiectul user
        const baseRole = userData.user.role;
        const allRoles = [...userRoles];
        
        // Adaugă rolul de bază dacă nu există deja în lista de roluri
        if (baseRole && !allRoles.find(role => role.name === baseRole)) {
          allRoles.push({ name: baseRole, permissions: [] });
        }

        const result = {
          userId: userData.user.id,
          email: userData.user.email,
          phone: userData.user.phone,
          roles: allRoles
        };

        this.logger.log(`Utilizator găsit și procesat pentru ${email}`);
        return result;
      }

      this.logger.error(`Utilizatorul cu email ${email} nu a fost găsit în răspuns`);
      return null;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului: ${error.message}`);
      return null;
    }
  }

  private async sendSms(phone: string, otp: string): Promise<boolean> {
    try {
      this.logger.log(`Încerc să trimit SMS către ${phone} cu OTP: ${otp}`);
      
      if (!this.apiKey) {
        this.logger.error('MOBILE_SMS_API_KEY nu este configurat! Nu se poate trimite SMS.');
        return false;
      }
      
      this.logger.log(`API Key configurat: DA`);
      this.logger.log(`API URL: ${this.apiUrl}`);
      
      // Convertește numărul în format international pentru SMSAdvert (+40 pentru România)
      const internationalPhone = phone.startsWith('0') ? '+40' + phone.substring(1) : phone;
      
      const data = {
        phone: internationalPhone,
        shortTextMessage: `Codul dvs de verificare este: ${otp}. Expiră în 5 minute.`,
        sendAsShort: true
      };

      this.logger.log(`📞 Număr original: ${phone}, Număr international: ${internationalPhone}`);

      this.logger.log(`Datele pentru SMS:`, JSON.stringify(data, null, 2));

      const config = {
        method: 'post',
        url: this.apiUrl,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        data: data
      };

      this.logger.log(`Configurația pentru request:`, JSON.stringify(config, null, 2));

      const response = await axios(config);

      this.logger.log(`Status Code SMSAdvert: ${response.status}`);
      this.logger.log(`Răspuns complet de la SMSAdvert:`, JSON.stringify(response.data, null, 2));

      if (response.data.successMessage) {
        this.logger.log(`✅ SMS TRIMIS CU SUCCES către ${phone}`);
        this.logger.log(`📱 Message ID: ${response.data.msgId}`);
        this.logger.log(`💰 Cost: ${response.data.cost || 'N/A'}`);
        this.logger.log(`📊 Credite rămase: ${response.data.credits || 'N/A'}`);
        this.logger.log(`🔢 OTP trimis: ${otp} (pentru debugging)`);
        return true;
      } else {
        this.logger.error(`❌ EROARE la trimiterea SMS:`);
        this.logger.error(`📋 Răspuns complet:`, JSON.stringify(response.data, null, 2));
        if (response.data.errors) {
          this.logger.error(`🚨 Erori specifice:`, JSON.stringify(response.data.errors, null, 2));
        }
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ EROARE la trimiterea SMS: ${error.message}`);
      
      // Dacă este o eroare de la SMSAdvert, afișează detaliile
      if (error.response) {
        this.logger.error(`🚨 Status Code: ${error.response.status}`);
        this.logger.error(`📋 Răspuns de eroare de la SMSAdvert:`, JSON.stringify(error.response.data, null, 2));
      }
      
      this.logger.error(`Stack trace:`, error.stack);
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
          roles: allRoles
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului după telefon: ${error.message}`);
      return null;
    }
  }
} 
import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../common/token.service';
import { TokenRotationService } from '../common/security/token-rotation.service';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';

interface OtpRecord {
  email: string;
  phone: string;
  otp: string;
  expiresAt: Date;
  userId: number;
  userData: any;
}

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://www.smsadvert.ro/api/sms/';

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
      const isEmail = this.isValidEmail(identifier);
      const isPhone = this.isValidPhone(identifier);

      if (!isEmail && !isPhone) {
        throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
      }

      let user;
      if (isEmail) {
        user = await this.findUserByEmail(identifier);
      } else {
        user = await this.findUserByPhone(identifier);
      }

      if (!user) {
        throw new UnauthorizedException('Credențiale invalide');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Credențiale invalide');
      }

      if (!user.phone) {
        throw new NotFoundException('Utilizatorul nu are număr de telefon asociat');
      }

      const otp = this.generateOtp();

      const smsSent = await this.sendSms(user.phone, otp);
      if (!smsSent) {
        throw new Error('Nu s-a putut trimite SMS-ul');
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      this.otpStorage.set(user.userId.toString(), {
        email: user.email,
        phone: user.phone,
        otp,
        expiresAt,
        userId: user.userId,
        userData: user,
      });

      this.logger.log(`Autentificare pas 1 reușită pentru ${user.email}, OTP trimis pe ${user.phone}`);

      return {
        message: `OTP trimis cu succes pe numărul ${user.phone}. Introduceți codul pentru a finaliza autentificarea.`,
        userId: user.userId,
      };
    } catch (error) {
      this.logger.error(`Eroare la pasul 1: ${error.message}`);
      throw error;
    }
  }

  async step2Verify(userId: number, otp: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      let otpRecord: OtpRecord | null = null;
      for (const [, record] of this.otpStorage.entries()) {
        if (record.userId === userId) {
          otpRecord = record;
          break;
        }
      }

      if (!otpRecord) {
        throw new UnauthorizedException('OTP invalid sau expirat. Completați din nou pasul 1.');
      }

      if (!this.otpMatches(otpRecord.otp, otp)) {
        throw new UnauthorizedException('OTP incorect');
      }

      if (otpRecord.expiresAt <= new Date()) {
        for (const [key, record] of this.otpStorage.entries()) {
          if (record.userId === userId) {
            this.otpStorage.delete(key);
            break;
          }
        }
        throw new UnauthorizedException('OTP expirat. Completați din nou pasul 1.');
      }

      const user = otpRecord.userData;

      if (!user) {
        throw new UnauthorizedException('Date utilizator lipsă. Completați din nou pasul 1.');
      }

      const employeeData = await this.usersService.findEmployeeByEmail(user.email);
      if (!employeeData) {
        throw new UnauthorizedException('Date utilizator lipsă. Completați din nou pasul 1.');
      }

      const localUser = await this.usersService.findByEmployeeId(employeeData.id);
      if (!localUser) {
        throw new UnauthorizedException('Utilizatorul nu a fost găsit.');
      }

      const userDataForToken = await this.usersService.buildUserDataForToken(
        employeeData.id,
        localUser.id,
        {
          profile_image: user.profile_image,
          is_2fa_active: true,
        },
      );

      const tokens = await this.tokenRotationService.generateTokensWithRotation(userDataForToken);

      for (const [key, record] of this.otpStorage.entries()) {
        if (record.userId === userId) {
          this.otpStorage.delete(key);
          break;
        }
      }

      this.logger.log(`Autentificare 2FA completă pentru ${user.email}`);
      return tokens;
    } catch (error) {
      this.logger.error(`Eroare în step2Verify: ${error.message}`);
      throw error;
    }
  }

  private async findUserByEmail(email: string): Promise<any> {
    try {
      const employeeData = await this.usersService.findEmployeeByEmail(email);
      if (!employeeData) return null;

      const user = await this.usersService.findByEmployeeIdWithPassword(employeeData.id);
      if (!user) return null;

      return {
        userId: user.id,
        email: employeeData.email,
        phone: employeeData.phone,
        password: user.password,
        profile_image: user.profile_image,
        roles: [],
      };
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului: ${error.message}`);
      return null;
    }
  }

  private async findUserByPhone(phone: string): Promise<any> {
    try {
      const employeeData = await this.usersService.findEmployeeByPhone(phone);
      if (!employeeData) return null;

      const user = await this.usersService.findByEmployeeIdWithPassword(employeeData.id);
      if (!user) return null;

      return {
        userId: user.id,
        email: employeeData.email,
        phone: employeeData.phone,
        password: user.password,
        profile_image: user.profile_image,
        roles: [],
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
        sendAsShort: true,
      };

      const config = {
        method: 'post',
        url: this.apiUrl,
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        data,
      };

      const response = await axios(config);

      if (response.data.successMessage) {
        this.logger.log(`SMS trimis cu succes către ${phone}. Message ID: ${response.data.msgId}`);
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

  /** Comparație constant-time — evită scurgerea codului OTP printr-un side-channel de timing. */
  private otpMatches(expected: string, provided: string): boolean {
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided ?? '');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
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

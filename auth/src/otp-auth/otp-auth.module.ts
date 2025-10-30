import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TwoFactorAuthController } from './otp-auth.controller';
import { OtpAuthService } from './otp-auth.service';
import { TokenModule } from '../common/token.module';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TokenModule,
    UsersModule,
    SecurityModule,
  ],
  controllers: [TwoFactorAuthController],
  providers: [OtpAuthService],
  exports: [OtpAuthService],
})
export class TwoFactorAuthModule {} 
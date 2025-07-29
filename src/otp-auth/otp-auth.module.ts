import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TwoFactorAuthController } from './otp-auth.controller';
import { TwoFactorAuthService } from './otp-auth.service';
import { TokenModule } from '../common/token.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TokenModule,
  ],
  controllers: [TwoFactorAuthController],
  providers: [TwoFactorAuthService],
  exports: [TwoFactorAuthService],
})
export class TwoFactorAuthModule {} 
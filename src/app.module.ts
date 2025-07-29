import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { TwoFactorAuthModule } from './otp-auth/otp-auth.module';
import { TwoFactorAuthModule as TwoFactorAuthModule2 } from './2fa-auth/2fa-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    TwoFactorAuthModule,
    TwoFactorAuthModule2
  ],
})
export class AppModule {}

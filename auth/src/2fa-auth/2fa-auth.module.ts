import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TwoFactorAuthController } from './2fa-auth.controller';
import { TwoFactorAuthService } from './2fa-auth.service';
import { TokenModule } from '../common/token.module';
import { SecurityModule } from '../common/security/security.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    HttpModule,
    TokenModule,
    SecurityModule,
    UsersModule,
  ],
  controllers: [TwoFactorAuthController],
  providers: [TwoFactorAuthService],
  exports: [TwoFactorAuthService],
})
export class TwoFactorAuthModule {} 
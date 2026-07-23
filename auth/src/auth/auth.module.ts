import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AnafLookupService } from './anaf-lookup.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { GuardsModule } from '../guards/guards.module';
import { TokenModule } from '../common/token.module';
import { SecurityModule } from '../common/security/security.module';
import { TwoFactorAuthModule } from '../2fa-auth/2fa-auth.module';


@Module({
  imports: [
    HttpModule,
    UsersModule,
    TokenModule,
    SecurityModule,
    GuardsModule,
    TwoFactorAuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error('JWT_SECRET nu este configurat în variabilele de mediu');
        }
        return {
          global: true,
          secret: jwtSecret,
          signOptions: { 
            expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m' 
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, AnafLookupService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {} 
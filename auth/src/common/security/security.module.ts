import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { BruteForceProtectionService } from './brute-force.service';
import { TokenRotationService } from './token-rotation.service';
import { SecurityAlertsService } from './security-alerts.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { SecurityCleanupService } from './cleanup.service';

@Module({
  imports: [
    ConfigModule,
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
  providers: [
    BruteForceProtectionService,
    TokenRotationService,
    SecurityAlertsService,
    AnomalyDetectionService,
    SecurityCleanupService,
  ],
  exports: [
    BruteForceProtectionService,
    TokenRotationService,
    SecurityAlertsService,
    AnomalyDetectionService,
    SecurityCleanupService,
  ],
})
export class SecurityModule {} 